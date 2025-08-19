"use client";

import { useState } from "react";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null };

export default function FlashcardsClient({ words }: { words: Word[] }) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const current = words[index] || null;

  function next() {
    setShowAnswer(false);
    setIndex((i) => (words.length === 0 ? 0 : (i + 1) % words.length));
  }
  function prev() {
    setShowAnswer(false);
    setIndex((i) => (words.length === 0 ? 0 : (i - 1 + words.length) % words.length));
  }

  if (words.length === 0) {
    return <div className="opacity-70">Add some words to practice.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="border rounded p-8 text-center cursor-pointer select-none min-h-48 flex flex-col items-center justify-center" onClick={() => setShowAnswer((s) => !s)}>
        {!showAnswer ? (
          <div>
            <div className="text-3xl font-semibold">{current?.hanzi}</div>
            <div className="opacity-70 mt-1">{current?.pinyin}</div>
          </div>
        ) : (
          <div>
            <div className="text-xl">{current?.english}</div>
            {current?.description ? <div className="opacity-80 mt-2 max-w-sm mx-auto">{current.description}</div> : null}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button className="px-3 py-1 rounded border" onClick={prev}>Prev</button>
        <div className="opacity-70 text-sm">{index + 1} / {words.length}</div>
        <button className="px-3 py-1 rounded border" onClick={next}>Next</button>
      </div>
    </div>
  );
}
