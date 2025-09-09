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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("fc-cat") || "";
  }); // empty = All
  const [selectedLessonId, setSelectedLessonId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("fc-lesson") || "";
  });
  const [mode, setMode] = useState<"words" | "conversations">(() => {
    if (typeof window === "undefined") return "words";
    const m = window.localStorage.getItem("fc-mode");
    return (m === "conversations" || m === "words") ? (m as "words" | "conversations") : "words";
  });
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

  // Restore persisted selections after mount (avoids SSR initial-state mismatch)
  useEffect(() => {
    try {
      const m = window.localStorage.getItem("fc-mode");
      if (m === "conversations" || m === "words") setMode(m as "words" | "conversations");
      const c = window.localStorage.getItem("fc-cat");
      if (typeof c === "string") setSelectedCategoryId(c);
      const l = window.localStorage.getItem("fc-lesson");
      if (typeof l === "string") setSelectedLessonId(l);
    } catch {}
  }, []);

  // Persist selections
  useEffect(() => {
    try { window.localStorage.setItem("fc-mode", mode); } catch {}
  }, [mode]);
  useEffect(() => {
    try { window.localStorage.setItem("fc-cat", selectedCategoryId); } catch {}
  }, [selectedCategoryId]);
  useEffect(() => {
    try { window.localStorage.setItem("fc-lesson", selectedLessonId); } catch {}
  }, [selectedLessonId]);

  // Ensure keys exist even before first change (set current state as defaults)
  useEffect(() => {
    try {
      if (window.localStorage.getItem("fc-mode") === null) {
        window.localStorage.setItem("fc-mode", mode);
      }
      if (window.localStorage.getItem("fc-cat") === null) {
        window.localStorage.setItem("fc-cat", selectedCategoryId);
      }
      if (window.localStorage.getItem("fc-lesson") === null) {
        window.localStorage.setItem("fc-lesson", selectedLessonId);
      }
    } catch {}
  }, [mode, selectedCategoryId, selectedLessonId]);

  function resetSession() {
    try {
      const resumeWords = `fc-idx:words:${selectedCategoryId || "all"}:${selectedLessonId || "all"}`;
      const resumeConv = `fc-idx:conversations:${selectedCategoryId || "all"}`;
      window.localStorage.removeItem("fc-mode");
      window.localStorage.removeItem("fc-cat");
      window.localStorage.removeItem("fc-lesson");
      window.localStorage.removeItem(resumeWords);
      window.localStorage.removeItem(resumeConv);
    } catch {}
    setMode("words");
    setSelectedCategoryId("");
    setSelectedLessonId("");
  }

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
          <select className="border rounded p-2 bg-transparent" value={mode} onChange={(e) => { const v = e.target.value as typeof mode; setMode(v); try { window.localStorage.setItem("fc-mode", v); } catch {} }}>
            <option value="words">Words</option>
            <option value="conversations">Conversations</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Category:</label>
          <select className="border rounded p-2 bg-transparent" value={selectedCategoryId} onChange={(e) => { const v = e.target.value; setSelectedCategoryId(v); try { window.localStorage.setItem("fc-cat", v); } catch {} }}>
            <option value="">All</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Lesson:</label>
          <select className="border rounded p-2 bg-transparent" value={selectedLessonId} onChange={(e) => { const v = e.target.value; setSelectedLessonId(v); try { window.localStorage.setItem("fc-lesson", v); } catch {} }} disabled={mode !== "words"}>
            <option value="">All</option>
            {lessons.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
        </div>
        <span className="text-xs opacity-70">{mode === "words" ? filteredWords.length : filteredConversations.length} cards</span>
        <button className="ml-auto px-3 py-1 rounded border text-sm hover:bg-black/5" onClick={resetSession}>Reset</button>
      </div>

      {mode === "words" ? (
        <FlashcardsClient
          words={filteredWords}
          mode="words"
          resumeKey={`words:${selectedCategoryId || "all"}:${selectedLessonId || "all"}`}
        />
      ) : (
        <FlashcardsClient
          words={filteredConversations as unknown as Word[]}
          mode="conversations"
          resumeKey={`conversations:${selectedCategoryId || "all"}`}
        />
      )}
    </div>
  );
}
