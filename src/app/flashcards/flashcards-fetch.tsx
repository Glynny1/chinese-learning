"use client";

import { useEffect, useState } from "react";
import FlashcardsClient from "./flashcards-client";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null };

export default function FlashcardsFetch() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch("/api/words", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const j: { words?: Array<Word> } = await res.json();
        if (isMounted) setWords(j.words ?? []);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load words");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <div className="opacity-70">Loading flashcards…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return <FlashcardsClient words={words} />;
}
