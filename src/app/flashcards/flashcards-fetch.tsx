"use client";

import { useEffect, useMemo, useState } from "react";
import FlashcardsClient from "./flashcards-client";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; category?: { id: string; name: string } | null; lesson?: { id: string; name: string } | { id: string; name: string }[] | null };
type Conversation = { id: string; hanzi: string; pinyin: string; english: string; category_id: string | null; conversation_order: number; type?: string | null };
type Category = { id: string; name: string };
type Lesson = { id: string; name: string };

export default function FlashcardsFetch() {
  const [words, setWords] = useState<Word[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(""); // empty = All
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [mode, setMode] = useState<"words" | "conversations">("words");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [wr, lr, cr, gr] = await Promise.all([
          fetch("/api/words", { cache: "no-store" }),
          fetch("/api/lessons", { cache: "no-store" }),
          fetch("/api/conversations", { cache: "no-store" }),
          fetch("/api/categories", { cache: "no-store" }),
        ]);
        if (!wr.ok) throw new Error(`Words failed: ${wr.status}`);
        // lessons may be empty; don't throw on lr failure, just derive from words
        const jw: { words?: Array<Word> } = await wr.json();
        let jl: { lessons?: Array<Lesson> } = { lessons: [] };
        try { if (lr.ok) jl = await lr.json(); } catch {}
        let jc: { conversations?: Array<Conversation> } = { conversations: [] };
        let jg: { categories?: Array<Category> } = { categories: [] };
        try { if (cr.ok) jc = await cr.json(); } catch {}
        try { if (gr.ok) jg = await gr.json(); } catch {}

        if (isMounted) {
          const ws = (jw.words ?? []).map((w) => ({
            ...w,
            lesson: Array.isArray(w.lesson) ? (w.lesson[0] ?? null) : (w.lesson ?? null),
            category: Array.isArray(w.category) ? (w.category[0] ?? null) : (w.category ?? null),
          }));
          const cs = (jc.conversations ?? []) as Conversation[];
          setWords(ws);
          setConversations(cs);
          // Prefer categories from API table; fall back to deriving from data if empty
          if (jg.categories && jg.categories.length > 0) {
            setCategories(jg.categories);
          } else {
            const cats = new Map<string, Category>();
            for (const w of ws) {
              const cid = (Array.isArray(w.category) ? w.category[0]?.id : w.category?.id) as string | undefined;
              const cname = (Array.isArray(w.category) ? w.category[0]?.name : w.category?.name) as string | undefined;
              if (cid) cats.set(cid, { id: cid, name: cname || "Category" });
            }
            for (const c of cs) {
              const cid = c.category_id || undefined;
              if (cid && !cats.has(cid)) cats.set(cid, { id: cid, name: "Category" });
            }
            setCategories(Array.from(cats.values()));
          }
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

  const filteredWords = useMemo(() => {
    let list = words;
    if (selectedCategoryId) list = list.filter((w) => (Array.isArray(w.category) ? (w.category[0]?.id) : w.category?.id) === selectedCategoryId);
    if (selectedLessonId) list = list.filter((w) => (Array.isArray(w.lesson) ? (w.lesson[0]?.id) : w.lesson?.id) === selectedLessonId);
    return list;
  }, [words, selectedCategoryId, selectedLessonId]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (selectedCategoryId) list = list.filter((c) => (c.category_id || "") === selectedCategoryId);
    // Ensure ordered by conversation_order ascending
    return [...list].sort((a, b) => (a.conversation_order ?? 0) - (b.conversation_order ?? 0));
  }, [conversations, selectedCategoryId]);

  if (loading) return <div className="opacity-70">Loading flashcards…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap p-3 border rounded bg-black/[.02]">
        <div className="flex items-center gap-2">
          <label className="text-sm">Mode:</label>
          <select className="border rounded p-2 bg-transparent" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="words">Words</option>
            <option value="conversations">Conversations</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Category:</label>
          <select className="border rounded p-2 bg-transparent" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Lesson:</label>
          <select className="border rounded p-2 bg-transparent" value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)} disabled={mode !== "words"}>
            <option value="">All</option>
            {lessons.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
        </div>
        <span className="text-xs opacity-70">{mode === "words" ? filteredWords.length : filteredConversations.length} cards</span>
      </div>

      {mode === "words" ? (
        <FlashcardsClient words={filteredWords} mode="words" />
      ) : (
        <FlashcardsClient words={filteredConversations as unknown as Word[]} mode="conversations" />
      )}
    </div>
  );
}
