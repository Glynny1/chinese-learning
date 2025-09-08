"use client";

import { useEffect, useMemo, useState } from "react";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; category?: { id: string; name: string } | null };

export default function WordsListClient() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch("/api/words", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const j: { words?: Array<{ id: string; hanzi: string; pinyin: string; english: string; description?: string | null; category?: { id: string; name: string } | { id: string; name: string }[] | null }>; } = await res.json();
        const rows = (j.words ?? []).map((w) => ({
          id: w.id,
          hanzi: w.hanzi,
          pinyin: w.pinyin,
          english: w.english,
          description: w.description ?? null,
          category: Array.isArray(w.category) ? (w.category[0] ?? null) : (w.category ?? null),
        }));
        if (isMounted) setWords(rows);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load words");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  function normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      // Strip diacritics (accents/tones) for more forgiving matching
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "") // remove most punctuation
      .replace(/\s+/g, " ")
      .trim();
  }

  function matches(word: Word, q: string): boolean {
    if (!q) return true;
    const nq = normalize(q);
    const haystack = normalize([
      word.hanzi || "",
      word.pinyin || "",
      word.english || "",
      word.description || "",
    ].join(" \u2002 "));
    // All tokens in the query must be present somewhere in the haystack
    const tokens = nq.split(" ").filter(Boolean);
    return tokens.every((t) => haystack.includes(t));
  }

  const filteredWords = useMemo(() => {
    return words.filter((w) => matches(w, query));
  }, [words, query]);

  if (loading) return <div className="opacity-70">Loading words…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="mt-8 space-y-3">
      <div className="mb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Hanzi, Pinyin, English, Description"
          className="border rounded p-2 w-full"
          aria-label="Search words"
        />
      </div>
      {filteredWords.map((w) => (
        <div key={w.id} className="border rounded p-3">
          <div className="font-semibold text-lg">{w.hanzi} <span className="opacity-60">{w.pinyin}</span></div>
          <div className="text-sm">{w.english}</div>
          {w.description ? <div className="text-sm opacity-80 mt-1">{w.description}</div> : null}
          {w.category?.name ? <div className="text-xs mt-2 px-2 py-1 rounded bg-black/5 inline-block">{w.category.name}</div> : null}
        </div>
      ))}
      {words.length === 0 && <div className="opacity-70">No words yet.</div>}
      {words.length > 0 && filteredWords.length === 0 && (
        <div className="opacity-70">No matches.</div>
      )}
    </div>
  );
}
