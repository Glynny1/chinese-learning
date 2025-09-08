"use client";

import { useEffect, useMemo, useState } from "react";
import FlashcardsClient from "./flashcards-client";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; sentence?: boolean | null; category?: { id: string; name: string } | null; lesson?: { id: string; name: string } | { id: string; name: string }[] | null };
type Category = { id: string; name: string };
type Lesson = { id: string; name: string };

export default function FlashcardsFetch() {
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(""); // empty = All
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [includeSentences, setIncludeSentences] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [wr, lr] = await Promise.all([
          fetch("/api/words", { cache: "no-store" }),
          fetch("/api/lessons", { cache: "no-store" }),
        ]);
        if (!wr.ok) throw new Error(`Words failed: ${wr.status}`);
        // lessons may be empty; don't throw on lr failure, just derive from words
        const jw: { words?: Array<Word> } = await wr.json();
        let jl: { lessons?: Array<Lesson> } = { lessons: [] };
        try { if (lr.ok) jl = await lr.json(); } catch {}

        if (isMounted) {
          const ws = (jw.words ?? []).map((w) => ({
            ...w,
            lesson: Array.isArray(w.lesson) ? (w.lesson[0] ?? null) : (w.lesson ?? null),
            category: Array.isArray(w.category) ? (w.category[0] ?? null) : (w.category ?? null),
          }));
          setWords(ws);
          // Derive categories from words since categories page is removed
          const cats = new Map<string, Category>();
          for (const w of ws) {
            const cid = (Array.isArray(w.category) ? w.category[0]?.id : w.category?.id) as string | undefined;
            const cname = (Array.isArray(w.category) ? w.category[0]?.name : w.category?.name) as string | undefined;
            if (cid) cats.set(cid, { id: cid, name: cname || "Category" });
          }
          setCategories(Array.from(cats.values()));
          setLessons(jl.lessons ?? []);
        }
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const filtered = useMemo(() => {
    let list = words;
    if (selectedCategoryId) list = list.filter((w) => (Array.isArray(w.category) ? (w.category[0]?.id) : w.category?.id) === selectedCategoryId);
    if (selectedLessonId) list = list.filter((w) => (Array.isArray(w.lesson) ? (w.lesson[0]?.id) : w.lesson?.id) === selectedLessonId);
    if (!includeSentences) list = list.filter((w) => w.sentence !== true);
    return list;
  }, [words, selectedCategoryId, selectedLessonId, includeSentences]);

  if (loading) return <div className="opacity-70">Loading flashcards…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap p-3 border rounded bg-black/[.02]">
        <div className="flex items-center gap-2">
          <label className="text-sm">Category:</label>
          <select className="border rounded p-2 bg-transparent" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Lesson:</label>
          <select className="border rounded p-2 bg-transparent" value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)}>
            <option value="">All</option>
            {lessons.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeSentences} onChange={(e) => setIncludeSentences(e.target.checked)} />
          Include sentences
        </label>
        <span className="text-xs opacity-70">{filtered.length} cards</span>
      </div>

      <FlashcardsClient words={filtered} />
    </div>
  );
}
