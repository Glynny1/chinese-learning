"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type Word = { id: string; hanzi: string; pinyin: string; english: string; description?: string | null; category?: { id: string; name: string } | null };

export default function WordsListClient() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

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

  const matches = useCallback((word: Word, q: string): boolean => {
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
  }, []);

  const filteredWords = useMemo(() => {
    return words.filter((w) => matches(w, query));
  }, [words, query, matches]);

  function chooseZhVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const v = voices.length ? voices : window.speechSynthesis.getVoices();
    const ting = v.find((x) => /ting[\-\s\u2010-\u2015]?ting/i.test(x.name));
    if (ting) return ting;
    return v.find((x) => x.lang?.toLowerCase().startsWith("zh")) || v.find((x) => /chinese|mandarin|cmn/i.test(x.name)) || v[0] || null;
  }

  function speakHanzi(text: string, id: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSpeakingId(id);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.7;
    u.pitch = 1.0;
    const v = chooseZhVoice();
    if (v) u.voice = v;
    try { window.speechSynthesis.resume(); } catch {}
    u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
    u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
    if (window.speechSynthesis.speaking) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    const delay = (window.speechSynthesis.getVoices().length > 0) ? 0 : 200;
    setTimeout(() => {
      try { window.speechSynthesis.speak(u); } catch {}
    }, delay);
  }

  if (loading) return <div className="space-y-3"><div className="animate-pulse border rounded h-10" /><div className="animate-pulse border rounded h-24" /><div className="animate-pulse border rounded h-24" /></div>;
  if (error) { toast.error(error); return <div className="text-red-600">{error}</div>; }

  return (
    <div className="mt-8 space-y-3">
      <div className="mb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Hanzi, Pinyin, English, Description"
          className="border input-theme p-2 w-full"
          aria-label="Search words"
        />
      </div>
      {/* Voice controls removed; using Ting‑Ting/Chinese voice at fixed rate/pitch */}
      {filteredWords.map((w) => (
        <div key={w.id} className="border rounded p-3">
          <div className="font-semibold text-lg flex items-center gap-2">
            <span>{w.hanzi}</span>
            <button
              className="text-sm px-2 py-1 rounded border hover:bg-black/5 active:translate-y-px active:scale-[0.98] transition"
              onClick={() => { if (speakingId === w.id) { try { window.speechSynthesis.cancel(); } catch {} setSpeakingId(null); } else { speakHanzi(w.hanzi, w.id); } }}
              aria-label={speakingId === w.id ? "Stop" : `Play ${w.hanzi}`}
              title={speakingId === w.id ? "Stop" : "Play"}
            >
              {speakingId === w.id ? "⏹" : "▶"}
            </button>
            <span className="opacity-60">{w.pinyin}</span>
          </div>
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
