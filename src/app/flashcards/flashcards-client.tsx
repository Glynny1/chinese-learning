"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";

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

// Treat literal "\n" text from the DB as real newlines for display
function normalizeNewlines(s?: string | null): string {
  return (s ?? "").replace(/\\n/g, "\n");
}

// Remote SRS sync helpers (logged-in users)
type SrsRow = {
  word_id: string;
  repetitions: number;
  ease: number;
  interval_days: number;
  due_at: string;
  last_grade: number | null;
};

function fromRow(row: SrsRow): CardState {
  return {
    repetitions: row.repetitions || 0,
    ease: row.ease || INITIAL_EASE,
    interval: row.interval_days || 0,
    dueAt: row.due_at,
    lastGrade: (row.last_grade === 0 || row.last_grade === 1 || row.last_grade === 2 || row.last_grade === 3)
      ? (row.last_grade as Grade)
      : null,
  };
}

function toRow(wordId: string, state: CardState): SrsRow {
  return {
    word_id: wordId,
    repetitions: state.repetitions,
    ease: state.ease,
    interval_days: state.interval,
    due_at: state.dueAt,
    last_grade: state.lastGrade ?? null,
  };
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

export default function FlashcardsClient({ words, mode = "words", resumeKey, listeningOnly = false }: { words: Word[]; mode?: "words" | "conversations" | "sentences"; resumeKey?: string; listeningOnly?: boolean }) {
  const [store, setStore] = useState<SrsStore>({ perCard: {}, daily: { date: todayKey(), newIntroduced: 0 } });
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const lastSpokenRef = useRef<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [flagged, setFlagged] = useState<Record<string, { flag: "again" | "hard"; hanzi: string; pinyin: string; english: string }>>({});
  const [canSyncFlags, setCanSyncFlags] = useState<boolean>(true);
  const [overrideWord, setOverrideWord] = useState<Word | null>(null);
  const [canSyncSrs, setCanSyncSrs] = useState<boolean>(true);

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
    if (mode === "sentences") {
      // Sentences should be random; no SRS spacing
      const a = [...words];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
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

  const current: Word | null = overrideWord ?? (effectiveQueue[index] ?? null);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => gradeCurrent(1), // Hard
    onSwipedRight: () => gradeCurrent(2), // Good
    onSwipedUp: () => setShowAnswer((s) => !s),
    onSwipedDown: () => setShowAnswer((s) => !s),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
  });

  function getTtsRate(): number { return 0.8; }
  function getTtsVoice(): string | undefined { return undefined; }

  async function requestTtsBlob(text: string, lang: string = "zh-CN", attempts: number = 2, timeoutMs: number = 8000, rate?: number, voice?: string): Promise<Blob> {
    let lastErr: unknown = null;
    for (let i = 0; i < attempts; i++) {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang, rate, voice }),
          signal: ac.signal,
        });
        clearTimeout(to);
        if (!res.ok) throw new Error(`tts ${res.status}`);
        return await res.blob();
      } catch (e) {
        clearTimeout(to);
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("tts failed");
  }

  // Persist index whenever it changes in conversations mode (sentences are random each time)
  useEffect(() => {
    try {
      if (resumeKey && typeof window !== "undefined" && mode === "conversations") {
        window.localStorage.setItem(`fc-idx:${resumeKey}`, String(index));
      }
    } catch {}
  }, [index, mode, resumeKey]);

  // Load flagged (Again/Hard) items per user
  useEffect(() => {
    if (mode !== "words") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/reviews", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) setCanSyncFlags(false);
          return;
        }
        const json: { flags?: Array<{ word_id: string; flag: "again" | "hard"; words?: { id: string; hanzi: string; pinyin: string; english: string } }> } = await res.json();
        if (!active) return;
        const map: Record<string, { flag: "again" | "hard"; hanzi: string; pinyin: string; english: string }> = {};
        for (const r of json.flags || []) {
          const w = r.words || { id: r.word_id, hanzi: "", pinyin: "", english: "" };
          map[r.word_id] = { flag: r.flag, hanzi: w.hanzi || "", pinyin: w.pinyin || "", english: w.english || "" };
        }
        setFlagged(map);
        setCanSyncFlags(true);
      } catch {
        setCanSyncFlags(false);
      }
    })();
    return () => { active = false; };
  }, [mode]);

  async function syncFlagFor(wordId: string, grade: Grade) {
    if (!canSyncFlags || mode !== "words") return;
    try {
      if (grade === 0 || grade === 1) {
        const flag = grade === 0 ? "again" : "hard" as const;
        await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word_id: wordId, flag }) });
      } else {
        await fetch("/api/reviews", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word_id: wordId }) });
      }
    } catch {}
  }

  // Load remote SRS for logged-in users and merge with local (server wins)
  useEffect(() => {
    if (mode !== "words") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/srs", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) setCanSyncSrs(false);
          return;
        }
        const json: { srs?: SrsRow[] } = await res.json();
        if (!active) return;
        const serverPerCard: Record<string, CardState> = {};
        for (const r of json.srs || []) {
          serverPerCard[r.word_id] = fromRow(r);
        }
        // Merge with local store; server overrides overlapping keys
        const local = loadStore();
        const merged: SrsStore = {
          perCard: { ...local.perCard, ...serverPerCard },
          daily: local.daily,
        };
        saveStore(merged);
        setStore(merged);
        setCanSyncSrs(true);
      } catch {
        setCanSyncSrs(false);
      }
    })();
    return () => { active = false; };
  }, [mode]);

  async function upsertSrs(wordId: string, state: CardState) {
    if (!canSyncSrs || mode !== "words") return;
    try {
      const body = { srs: [toRow(wordId, state)] };
      await fetch("/api/srs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {}
  }

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
    // Removed server logging per request
    if (mode !== "words") {
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

    // Update flagged list (Again/Hard add; Good/Easy remove)
    if (mode === "words") {
      if (grade === 0 || grade === 1) {
        const f = grade === 0 ? "again" : "hard";
        setFlagged((m) => ({
          ...m,
          [current.id]: {
            flag: f,
            hanzi: current.hanzi,
            pinyin: current.pinyin,
            english: current.english,
          },
        }));
      } else {
        setFlagged((m) => {
          if (!m[current.id]) return m;
          const c = { ...m };
          delete c[current.id];
          return c;
        });
      }
      void syncFlagFor(current.id, grade);
    }

    // Upsert SRS remotely (logged-in users)
    void upsertSrs(current.id, nextState);

    setReviewed((r) => r + 1);
    if (grade >= 2) setCorrect((c) => c + 1);

    if (effectiveQueue.length <= 1) {
      setIndex(0);
      setShowAnswer(false);
    } else {
      setIndex((i) => (i + 1) % effectiveQueue.length);
      setShowAnswer(false);
    }
    setOverrideWord(null);
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
    // If something is already playing (Audio), stop it first
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
    } catch {}
    setSpeaking(true);
    lastSpokenRef.current = text;
    // Try server TTS first
    (async () => {
      try {
        const rate = getTtsRate();
        const voice = getTtsVoice();
        const blob = await requestTtsBlob(text, "zh-CN", 2, 8000, rate, voice);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;
        currentAudioUrlRef.current = url;
        try { audio.playbackRate = rate; } catch {}
        audio.onended = () => { setSpeaking(false); try { URL.revokeObjectURL(url); } catch {}; if (currentAudioRef.current === audio) { currentAudioRef.current = null; currentAudioUrlRef.current = null; } };
        audio.onerror = () => { setSpeaking(false); try { URL.revokeObjectURL(url); } catch {}; if (currentAudioRef.current === audio) { currentAudioRef.current = null; currentAudioUrlRef.current = null; } };
        await audio.play();
        return;
      } catch {
        // Fallback to browser TTS
        try {
          if (typeof window === "undefined" || !("speechSynthesis" in window)) { setSpeaking(false); return; }
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
            try { window.speechSynthesis.speak(u); } catch { setSpeaking(false); }
          }, delay);
        } catch { setSpeaking(false); }
      }
    })();
  }

  const dueCount = useMemo(() => {
    let n = 0;
    for (const w of words) {
      if (isDue(store.perCard[w.id])) n += 1;
    }
    return n;
  }, [words, store]);

  if (words.length === 0) {
    return <div className="opacity-70">No words available. Please select a different mode or category.</div>;
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

      <div className="grid gap-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px]">
        <div className="[perspective:1000px]" {...swipeHandlers}>
          <div
            className={`relative h-[320px] sm:h-[360px] md:h-[min(50vh,400px)] lg:h-[min(52vh,440px)] xl:h-[min(54vh,480px)] w-full transition-transform duration-500 [transform-style:preserve-3d] ${showAnswer ? "[transform:rotateY(180deg)]" : ""}`}
            onClick={() => setShowAnswer((s) => !s)}
          >
          <div className="absolute inset-0 border rounded-lg p-8 sm:p-10 text-center cursor-pointer select-none flex flex-col items-center justify-center bg-background [backface-visibility:hidden] overflow-hidden">
            <div className="h-6 mb-2">
              {mode === "conversations" && current?.type ? (
                <div className="text-sm uppercase tracking-wide opacity-85 max-w-[96%] whitespace-nowrap">{current.type}</div>
              ) : null}
            </div>
            <div className="font-semibold flex items-center gap-3 justify-center text-[clamp(24px,7vw,64px)] leading-snug whitespace-normal max-w-[92%]">
              {!listeningOnly && <span className="break-words">{current?.hanzi}</span>}
              <button
                className="text-sm px-2 py-1 btn-ghost"
                onClick={(e) => { e.stopPropagation(); if (speaking) { try { if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0; } } catch {}; try { if (currentAudioUrlRef.current) { URL.revokeObjectURL(currentAudioUrlRef.current); currentAudioUrlRef.current = null; } } catch {}; try { window.speechSynthesis.cancel(); } catch {}; setSpeaking(false); } else { speakCurrent(); } }}
                aria-label={speaking ? "Stop" : (current?.hanzi ? `Play ${current.hanzi}` : "Play")}
                title={speaking ? "Stop" : "Play"}
              >
                {speaking ? "⏹" : "▶"}
              </button>
            </div>
            {!listeningOnly && (
              <div className="opacity-85 mt-2 text-[clamp(14px,3.5vw,22px)] whitespace-normal break-words max-w-[92%] leading-snug">
                {current?.pinyin}
              </div>
            )}
          </div>
          <div className="absolute inset-0 border rounded-lg p-8 sm:p-10 text-center cursor-pointer select-none flex flex-col items-center justify-center bg-background [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {!listeningOnly && (
              <>
                <div className="text-[clamp(20px,5vw,36px)] leading-snug whitespace-pre-line break-words max-w-[92%]">{normalizeNewlines(current?.english)}</div>
                {current?.description ? (
                  <div className="opacity-80 mt-3 max-w-md mx-auto whitespace-pre-line break-words text-[clamp(14px,3.5vw,20px)] leading-relaxed">
                    {normalizeNewlines(current.description)}
                  </div>
                ) : null}
              </>
            )}
          </div>
          </div>
        </div>

        {mode === "words" ? (
          <aside className="hidden md:block border rounded p-3 md:h-[min(50vh,400px)] lg:h-[min(52vh,440px)] xl:h-[min(54vh,480px)] overflow-auto">
            <div className="text-sm font-medium mb-2">Review Later</div>
            {canSyncFlags ? (
              Object.keys(flagged).length > 0 ? (
                <ul className="space-y-1">
                  {Object.entries(flagged).map(([id, f]) => (
                    <li key={id}>
                      <button
                        className="w-full text-left text-sm px-2 py-1 rounded border flex items-center justify-between gap-2 hover:bg-black/5 hover:shadow-sm transition-transform duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-black/10"
                        onClick={() => {
                          const found = words.find((w) => w.id === id);
                          const w: Word = found || { id, hanzi: f.hanzi, pinyin: f.pinyin, english: f.english, description: null, type: null } as Word;
                          setOverrideWord(w);
                          setShowAnswer(false);
                        }}
                      >
                        <span className="truncate">
                          {f.hanzi || "(card)"}
                          <span className="opacity-70 ml-2">{f.pinyin}</span>
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${f.flag === "again" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>{f.flag}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs opacity-70">No cards flagged as Again/Hard.</div>
              )
            ) : (
              <div className="text-xs opacity-70">Please Login via Google to track Harder cards</div>
            )}
          </aside>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:static fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur px-4 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-0 sm:py-0 border-t sm:border-0">
        <button className="px-3 py-2 btn-ghost" title="1" onClick={() => gradeCurrent(0)}>Again</button>
        <button className="px-3 py-2 btn-ghost" title="2" onClick={() => gradeCurrent(1)}>Hard</button>
        <button className="px-3 py-2 btn-ghost" title="3" onClick={() => gradeCurrent(2)}>Good</button>
        <button className="px-3 py-2 btn-ghost" title="4" onClick={() => gradeCurrent(3)}>Easy</button>
      </div>

      {/* Voice controls removed; using Ting‑Ting/Chinese voice at fixed rate/pitch */}

      <div className="flex items-center justify-between text-sm opacity-70 pb-16 sm:pb-0">
        <div>Card {effectiveQueue.length ? index + 1 : 0} / {effectiveQueue.length}</div>
        <div>Shortcuts: 1–4</div>
      </div>
      </div>
  );
}
