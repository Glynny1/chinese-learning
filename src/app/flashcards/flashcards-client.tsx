"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; type?: string | null };

type Grade = 0 | 1 | 2 | 3; // 0=Again,1=Hard,2=Good,3=Easy

type CardState = {
  repetitions: number; // successful reps (Good/Easy)
  ease: number; // ease factor
  interval: number; // days
  dueAt: string; // ISO timestamp
  lastGrade: Grade | null;
};

type SrsStore = {
  perCard: Record<string, CardState>;
  daily: { date: string; newIntroduced: number };
};

const STORAGE_KEY = "srs-v1";
const INITIAL_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const AGAIN_REVIEW_DELAY_MINUTES = 10; // quick relearn within session
const NEW_DAILY_CAP = 50;

function todayKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function loadStore(): SrsStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { perCard: {}, daily: { date: todayKey(), newIntroduced: 0 } };
    const parsed = JSON.parse(raw) as SrsStore;
    const t = todayKey();
    if (parsed.daily?.date !== t) {
      return { perCard: parsed.perCard || {}, daily: { date: t, newIntroduced: 0 } };
    }
    return { perCard: parsed.perCard || {}, daily: parsed.daily || { date: t, newIntroduced: 0 } };
  } catch {
    return { perCard: {}, daily: { date: todayKey(), newIntroduced: 0 } };
  }
}

function saveStore(store: SrsStore): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function scheduleNext(current: CardState | undefined, grade: Grade): CardState {
  const now = new Date();
  const base: CardState = current ?? {
    repetitions: 0,
    ease: INITIAL_EASE,
    interval: 0,
    dueAt: now.toISOString(),
    lastGrade: null,
  };

  let { repetitions, ease, interval } = base;

  if (grade === 0) {
    repetitions = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    interval = 0;
    const due = new Date(now.getTime() + AGAIN_REVIEW_DELAY_MINUTES * 60_000);
    return { repetitions, ease, interval, dueAt: due.toISOString(), lastGrade: grade };
  }

  if (grade === 1) {
    ease = Math.max(MIN_EASE, ease - 0.15);
    interval = repetitions <= 1 ? 1 : Math.max(1, Math.round(interval * 1.2));
    const due = new Date(now.getTime() + interval * 24 * 60 * 60_000);
    return { repetitions, ease, interval, dueAt: due.toISOString(), lastGrade: grade };
  }

  const isFirst = repetitions === 0;
  const isSecond = repetitions === 1;

  if (grade === 2) {
    ease = Math.min(MAX_EASE, ease + 0.1);
    if (isFirst) interval = 1;
    else if (isSecond) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    repetitions = repetitions + 1;
  } else {
    ease = Math.min(MAX_EASE, ease + 0.15);
    if (isFirst) interval = 2;
    else if (isSecond) interval = 7;
    else interval = Math.max(1, Math.round(interval * (ease + 0.15)));
    repetitions = repetitions + 1;
  }
  const due = new Date(now.getTime() + interval * 24 * 60 * 60_000);
  return { repetitions, ease, interval, dueAt: due.toISOString(), lastGrade: grade };
}

function isDue(state: CardState | undefined): boolean {
  if (!state) return true; // new cards considered due (subject to cap)
  return new Date(state.dueAt).getTime() <= Date.now();
}

export default function FlashcardsClient({ words, mode = "words", resumeKey }: { words: Word[]; mode?: "words" | "conversations"; resumeKey?: string }) {
  const [store, setStore] = useState<SrsStore>({ perCard: {}, daily: { date: todayKey(), newIntroduced: 0 } });
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const lastSpokenRef = useRef<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    function captureVoices() {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length) setVoices(v);
    }
    window.speechSynthesis.onvoiceschanged = captureVoices;
    captureVoices();
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Fixed voice/rate/pitch settings; no UI controls here

  const queue: Word[] = useMemo(() => {
    if (!words || words.length === 0) return [];
    if (mode === "conversations") {
      // Conversations should preserve provided order (already sorted upstream)
      return [...words];
    }
    const due: Word[] = [];
    const fresh: Word[] = [];
    for (const w of words) {
      const st = store.perCard[w.id];
      if (!st) fresh.push(w);
      else if (isDue(st)) due.push(w);
    }
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const cappedFreshCount = Math.max(0, NEW_DAILY_CAP - store.daily.newIntroduced);
    const freshCapped = shuffle(fresh).slice(0, cappedFreshCount);
    return [...shuffle(due), ...freshCapped];
  }, [words, store, mode]);

  // If no due/new, fall back to practicing the whole filtered set so it never goes blank
  const effectiveQueue = queue.length > 0 ? queue : words;

  useEffect(() => {
    if (effectiveQueue.length > 0) {
      let start = 0;
      if (resumeKey && typeof window !== "undefined") {
        const saved = Number(window.localStorage.getItem(`fc-idx:${resumeKey}`) || "0");
        if (!Number.isNaN(saved) && saved >= 0 && saved < effectiveQueue.length) start = saved;
      }
      setIndex(mode === "conversations" ? start : Math.floor(Math.random() * effectiveQueue.length));
      setShowAnswer(false);
    } else {
      setIndex(0);
      setShowAnswer(false);
    }
  }, [effectiveQueue.length, mode, resumeKey]);

  const current: Word | null = effectiveQueue[index] ?? null;

  // Persist index whenever it changes in conversations mode
  useEffect(() => {
    try {
      if (resumeKey && typeof window !== "undefined" && mode === "conversations") {
        window.localStorage.setItem(`fc-idx:${resumeKey}`, String(index));
      }
    } catch {}
  }, [index, mode, resumeKey]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "1") gradeCurrent(0);
      else if (e.key === "2") gradeCurrent(1);
      else if (e.key === "3") gradeCurrent(2);
      else if (e.key === "4") gradeCurrent(3);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveQueue, index, store]);

  function gradeCurrent(grade: Grade) {
    if (!current) return;
    if (mode === "conversations") {
      // Linear progression: always move to the next card in order
      setReviewed((r) => r + 1);
      if (grade >= 2) setCorrect((c) => c + 1);
      setIndex((i) => (i + 1 < effectiveQueue.length ? i + 1 : 0));
      setShowAnswer(false);
      return;
    }

    const prev = loadStore();
    const curState = prev.perCard[current.id];
    const nextState = scheduleNext(curState, grade);

    if (!curState) {
      const t = todayKey();
      if (prev.daily.date !== t) prev.daily = { date: t, newIntroduced: 0 };
      prev.daily.newIntroduced = prev.daily.newIntroduced + 1;
    }

    prev.perCard[current.id] = nextState;
    saveStore(prev);
    setStore(prev);

    setReviewed((r) => r + 1);
    if (grade >= 2) setCorrect((c) => c + 1);

    if (effectiveQueue.length <= 1) {
      setIndex(0);
      setShowAnswer(false);
    } else {
      setIndex((i) => (i + 1) % effectiveQueue.length);
      setShowAnswer(false);
    }
    // Persist index after moving
    try {
      if (resumeKey && typeof window !== "undefined") {
        const nextIdx = mode === ("conversations" as typeof mode) ? Math.min(index + 1, effectiveQueue.length - 1) : index;
        window.localStorage.setItem(`fc-idx:${resumeKey}` , String(nextIdx));
      }
    } catch {}
  }

  function chooseZhVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const v = voices.length ? voices : window.speechSynthesis.getVoices();
    const ting = v.find((x) => /ting[\-\s\u2010-\u2015]?ting/i.test(x.name));
    if (ting) return ting;
    return v.find((x) => x.lang?.toLowerCase().startsWith("zh")) || v.find((x) => /chinese|mandarin|cmn/i.test(x.name)) || v[0] || null;
  }

  function speakCurrent() {
    const text = current?.hanzi?.trim();
    if (!text) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSpeaking(true);
    lastSpokenRef.current = text;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.7;
    u.pitch = 1.0;
    const v = chooseZhVoice();
    if (v) u.voice = v;
    try { window.speechSynthesis.resume(); } catch {}
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    if (window.speechSynthesis.speaking) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    const delay = (window.speechSynthesis.getVoices().length > 0) ? 0 : 200;
    setTimeout(() => {
      try { window.speechSynthesis.speak(u); } catch {}
    }, delay);
  }

  const dueCount = useMemo(() => {
    let n = 0;
    for (const w of words) {
      if (isDue(store.perCard[w.id])) n += 1;
    }
    return n;
  }, [words, store]);

  if (words.length === 0) {
    return <div className="opacity-70">Add some words to practice.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="opacity-80">Reviewed: {reviewed} · Accuracy: {reviewed ? Math.round((correct / reviewed) * 100) : 0}%</div>
        {mode === "words" ? (
          <div className="opacity-60">Due now: {dueCount}</div>
        ) : (
          <div className="opacity-60">Sequence</div>
        )}
      </div>

      <div className="[perspective:1000px]">
        <div
          className={`relative h-[380px] sm:h-[420px] md:h-[460px] w-full transition-transform duration-500 [transform-style:preserve-3d] ${showAnswer ? "[transform:rotateY(180deg)]" : ""}`}
          onClick={() => setShowAnswer((s) => !s)}
        >
          <div className="absolute inset-0 border rounded-lg p-8 sm:p-10 text-center cursor-pointer select-none flex flex-col items-center justify-center bg-background [backface-visibility:hidden] overflow-hidden">
            <div className="h-6 mb-2">
              {mode === "conversations" && current?.type ? (
                <div className="text-sm uppercase tracking-wide opacity-85 max-w-[96%] whitespace-nowrap">{current.type}</div>
              ) : null}
            </div>
            <div className="font-semibold flex items-center gap-3 justify-center text-[clamp(24px,7vw,64px)] leading-snug whitespace-normal max-w-[92%]">
              <span className="break-words">{current?.hanzi}</span>
              <button
                className="text-sm px-2 py-1 rounded border active:translate-y-px active:scale-[0.98] hover:bg-black/5 transition"
                onClick={(e) => { e.stopPropagation(); if (speaking) { try { window.speechSynthesis.cancel(); } catch {} setSpeaking(false); } else { speakCurrent(); } }}
                aria-label={speaking ? "Stop" : (current?.hanzi ? `Play ${current.hanzi}` : "Play")}
                title={speaking ? "Stop" : "Play"}
              >
                {speaking ? "⏹" : "▶"}
              </button>
            </div>
            <div className="opacity-85 mt-2 text-[clamp(14px,3.5vw,22px)] whitespace-normal break-words max-w-[92%] leading-snug">
              {current?.pinyin}
            </div>
          </div>
          <div className="absolute inset-0 border rounded-lg p-8 sm:p-10 text-center cursor-pointer select-none flex flex-col items-center justify-center bg-background [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="text-[clamp(20px,5vw,36px)] leading-snug whitespace-normal break-words max-w-[92%]">{current?.english}</div>
            {current?.description ? (
              <div className="opacity-80 mt-3 max-w-md mx-auto whitespace-pre-line break-words text-[clamp(14px,3.5vw,20px)] leading-relaxed">
                {current.description}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button className="px-3 py-2 rounded border hover:bg-black/5 active:translate-y-px active:scale-[0.98] transition" title="1" onClick={() => gradeCurrent(0)}>Again</button>
        <button className="px-3 py-2 rounded border hover:bg-black/5 active:translate-y-px active:scale-[0.98] transition" title="2" onClick={() => gradeCurrent(1)}>Hard</button>
        <button className="px-3 py-2 rounded border bg-black text-white hover:opacity-90 active:translate-y-px active:scale-[0.98] transition" title="3" onClick={() => gradeCurrent(2)}>Good</button>
        <button className="px-3 py-2 rounded border hover:bg-black/5 active:translate-y-px active:scale-[0.98] transition" title="4" onClick={() => gradeCurrent(3)}>Easy</button>
      </div>

      {/* Voice controls removed; using Ting‑Ting/Chinese voice at fixed rate/pitch */}

      <div className="flex items-center justify-between text-sm opacity-70">
        <div>Card {effectiveQueue.length ? index + 1 : 0} / {effectiveQueue.length}</div>
        <div>Shortcuts: 1–4</div>
      </div>
    </div>
  );
}
