"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import FlashcardsClient from "./flashcards-client";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; category?: { id: string; name: string } | null };
type Conversation = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; category_id: string | null; conversation_order: number; type?: string | null };
type Sentence = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; category_id: string | null };
type Category = { id: string; name: string };
// lessons removed

export default function FlashcardsFetch() {
  const [words, setWords] = useState<Word[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  // lessons removed
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("fc-cat") || "";
  }); // empty = All
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  type Mode = "words" | "conversations" | "sentences";
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "words";
    const m = window.localStorage.getItem("fc-mode");
    return (m === "conversations" || m === "words" || m === "sentences") ? (m as Mode) : "words";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listeningOnly, setListeningOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("fc-listen") === "1";
  });
  // TTS settings fixed; no UI or persistence

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [wr, cr, sr, gr] = await Promise.all([
          fetch("/api/words", { cache: "no-store" }),
          fetch("/api/conversations", { cache: "no-store" }),
          fetch("/api/sentences", { cache: "no-store" }),
          fetch("/api/categories", { cache: "no-store" }),
        ]);
        if (!wr.ok) throw new Error(`Words failed: ${wr.status}`);
        // lessons may be empty; don't throw on lr failure, just derive from words
        const jw: { words?: Array<Word> } = await wr.json();
        let jc: { conversations?: Array<Conversation> } = { conversations: [] };
        let js: { sentences?: Array<Sentence> } = { sentences: [] };
        let jg: { categories?: Array<Category> } = { categories: [] };
        try { if (cr.ok) jc = await cr.json(); } catch {}
        try { if (sr.ok) js = await sr.json(); } catch {}
        try { if (gr.ok) jg = await gr.json(); } catch {}

        if (isMounted) {
          const ws = (jw.words ?? []).map((w) => ({
            ...w,
            category: Array.isArray(w.category) ? (w.category[0] ?? null) : (w.category ?? null),
          }));
          const cs = (jc.conversations ?? []) as Conversation[];
          setWords(ws);
          setConversations(cs);
          setSentences(js.sentences ?? []);
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
          // lessons removed
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
      if (m === "conversations" || m === "words" || m === "sentences") setMode(m as Mode);
      const c = window.localStorage.getItem("fc-cat");
      if (typeof c === "string") setSelectedCategoryId(c);
      const l = window.localStorage.getItem("fc-lesson");
      if (typeof l === "string") setSelectedLessonId(l);
      const lst = window.localStorage.getItem("fc-listen");
      if (lst === "0" || lst === "1") setListeningOnly(lst === "1");
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
  useEffect(() => {
    try { window.localStorage.setItem("fc-listen", listeningOnly ? "1" : "0"); } catch {}
  }, [listeningOnly]);
  // No tts voice/rate persistence

  // Removed voice list fetch; using Google default zh-CN voice

  // Notify error changes (must be outside of render branches to keep Hooks order stable)
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

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
    return list;
  }, [words, selectedCategoryId]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (selectedCategoryId) list = list.filter((c) => (c.category_id || "") === selectedCategoryId);
    // Ensure ordered by conversation_order ascending
    return [...list].sort((a, b) => (a.conversation_order ?? 0) - (b.conversation_order ?? 0));
  }, [conversations, selectedCategoryId]);

  // Compute which categories actually have items for the current mode
  const availableCategoryIdsForWords = useMemo(() => {
    const ids = new Set<string>();
    for (const w of words) {
      const cid = (Array.isArray(w.category) ? w.category?.[0]?.id : w.category?.id) as string | undefined;
      if (cid) ids.add(cid);
    }
    return ids;
  }, [words]);

  const availableCategoryIdsForConversations = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conversations) {
      if (c.category_id) ids.add(c.category_id);
    }
    return ids;
  }, [conversations]);

  const availableCategoryIdsForSentences = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sentences) {
      const cid = s.category_id || undefined;
      if (cid) ids.add(cid);
    }
    return ids;
  }, [sentences]);

  const visibleCategories = useMemo(() => {
    const allow = mode === "words" ? availableCategoryIdsForWords : (mode === "conversations" ? availableCategoryIdsForConversations : availableCategoryIdsForSentences);
    // If no categories are available yet (e.g., empty dataset), fall back to all categories
    if (allow.size === 0) return categories;
    return categories.filter((c) => allow.has(c.id));
  }, [categories, mode, availableCategoryIdsForWords, availableCategoryIdsForConversations, availableCategoryIdsForSentences]);

  // If current selection isn't available in the current mode, reset to All
  useEffect(() => {
    const allow = mode === "words" ? availableCategoryIdsForWords : (mode === "conversations" ? availableCategoryIdsForConversations : availableCategoryIdsForSentences);
    if (selectedCategoryId && !allow.has(selectedCategoryId)) {
      setSelectedCategoryId("");
    }
  }, [mode, selectedCategoryId, availableCategoryIdsForWords, availableCategoryIdsForConversations, availableCategoryIdsForSentences]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse border rounded p-3 bg-white/5 h-14" />
        <div className="animate-pulse border rounded h-[380px] sm:h-[420px] md:h-[460px]" />
      </div>
    );
  }
  if (error) { return <div className="text-red-600">{error}</div>; }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap p-3 border rounded bg-black/[.02]">
        <div className="flex items-center gap-2">
          <label className="text-sm">Mode:</label>
          <select className="border input-theme p-2 bg-transparent" value={mode} onChange={(e) => { const v = e.target.value as typeof mode; setMode(v); try { window.localStorage.setItem("fc-mode", v); } catch {} }}>
            <option value="words">Words</option>
            <option value="conversations">Conversations</option>
            <option value="sentences">Sentences</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Category:</label>
          <select className="border input-theme p-2 bg-transparent" value={selectedCategoryId} onChange={(e) => { const v = e.target.value; setSelectedCategoryId(v); try { window.localStorage.setItem("fc-cat", v); } catch {} }}>
            <option value="">All</option>
            {visibleCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        
        <span className="text-xs opacity-70">{mode === "words" ? filteredWords.length : (mode === "conversations" ? filteredConversations.length : sentences.length)} cards</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={listeningOnly} onChange={(e) => setListeningOnly(e.target.checked)} />
          Listening only
        </label>
        {/* TTS controls removed (fixed defaults) */}
        <button className="px-3 py-1 rounded border text-sm hover:bg-black/5" onClick={resetSession}>Reset</button>
      </div>

      {mode === "words" ? (
        <FlashcardsClient
          words={filteredWords}
          mode="words"
          resumeKey={`words:${selectedCategoryId || "all"}`}
          listeningOnly={listeningOnly}
        />
      ) : mode === "conversations" ? (
        <FlashcardsClient
          words={filteredConversations as unknown as Word[]}
          mode="conversations"
          resumeKey={`conversations:${selectedCategoryId || "all"}`}
          listeningOnly={listeningOnly}
        />
      ) : (
        <FlashcardsClient
          words={sentences as unknown as Word[]}
          mode="sentences"
          resumeKey={`sentences:${selectedCategoryId || "all"}`}
          listeningOnly={listeningOnly}
        />
      )}
    </div>
  );
}
