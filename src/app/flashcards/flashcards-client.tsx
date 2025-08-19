"use client";

import { useEffect, useMemo, useState } from "react";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null };

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
    // Again: quick relearn
    repetitions = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    interval = 0;
    const due = new Date(now.getTime() + AGAIN_REVIEW_DELAY_MINUTES * 60_000);
    return { repetitions, ease, interval, dueAt: due.toISOString(), lastGrade: grade };
  }

  if (grade === 1) {
    // Hard: small penalty, short interval
    ease = Math.max(MIN_EASE, ease - 0.15);
    interval = repetitions <= 1 ? 1 : Math.max(1, Math.round(interval * 1.2));
    const due = new Date(now.getTime() + interval * 24 * 60 * 60_000);
    return { repetitions, ease, interval, dueAt: due.toISOString(), lastGrade: grade };
  }

  // Good/Easy
  const isFirst = repetitions === 0;
  const isSecond = repetitions === 1;

  if (grade === 2) {
    ease = Math.min(MAX_EASE, ease + 0.1);
    if (isFirst) interval = 1;
    else if (isSecond) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    repetitions = repetitions + 1;
  } else {
    // Easy
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

export default function FlashcardsClient({ words }: { words: Word[] }) {
  const [store, setStore] = useState<SrsStore>({ perCard: {}, daily: { date: todayKey(), newIntroduced: 0 } });
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);

  // Load SRS store once
  useEffect(() => {
    setStore(loadStore());
  }, []);

  // Build queue: due first, then new (respect daily cap). Shuffle within groups.
  const queue: Word[] = useMemo(() => {
    if (!words || words.length === 0) return [];
    const due: Word[] = [];
    const fresh: Word[] = [];
    for (const w of words) {
      const st = store.perCard[w.id];
      if (!st) fresh.push(w);
      else if (isDue(st)) due.push(w);
    }
    // Shuffle helper
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
  }, [words, store]);

  // When the queue rebuilds, pick a random start
  useEffect(() => {
    if (queue.length > 0) {
      setIndex(Math.floor(Math.random() * queue.length));
      setShowAnswer(false);
    } else {
      setIndex(0);
      setShowAnswer(false);
    }
  }, [queue.length]);

  const current: Word | null = queue[index] ?? null;

  // Keyboard shortcuts 1..4
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
  }, [queue, index, store]);

  function gradeCurrent(grade: Grade) {
    if (!current) return;
    const prev = loadStore();
    const curState = prev.perCard[current.id];
    const nextState = scheduleNext(curState, grade);

    // Track daily new introductions
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

    // Advance to next card within the new queue
    if (queue.length <= 1) {
      setIndex(0);
      setShowAnswer(false);
    } else {
      setIndex((i) => (i + 1) % queue.length);
      setShowAnswer(false);
    }
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
        <div className="opacity-60">Due now: {dueCount}</div>
      </div>

      <div className="border rounded p-8 text-center cursor-pointer select-none min-h-48 flex flex-col items-center justify-center" onClick={() => setShowAnswer((s) => !s)}>
        {!showAnswer ? (
          <div>
            <div className="text-3xl font-semibold">{current?.hanzi}</div>
            <div className="opacity-70 mt-1">{current?.pinyin}</div>
          </div>
        ) : (
          <div>
            <div className="text-xl">{current?.english}</div>
            {current?.description ? <div className="opacity-80 mt-2 max-w-sm mx-auto whitespace-pre-line">{current.description}</div> : null}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button className="px-3 py-2 rounded border" title="1" onClick={() => gradeCurrent(0)}>Again</button>
        <button className="px-3 py-2 rounded border" title="2" onClick={() => gradeCurrent(1)}>Hard</button>
        <button className="px-3 py-2 rounded border bg-black text-white" title="3" onClick={() => gradeCurrent(2)}>Good</button>
        <button className="px-3 py-2 rounded border" title="4" onClick={() => gradeCurrent(3)}>Easy</button>
      </div>

      <div className="flex items-center justify-between text-sm opacity-70">
        <div>Card {queue.length ? index + 1 : 0} / {queue.length}</div>
        <div>Shortcuts: 1–4</div>
      </div>
    </div>
  );
}
