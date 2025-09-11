"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const OWNER_USER_ID = process.env.NEXT_PUBLIC_OWNER_USER_ID || process.env.OWNER_USER_ID || "";

type Category = { id: string; name: string };
type Lesson = { id: string; name: string };

export function WordsForm() {
  const router = useRouter();
  const [form, setForm] = useState({ hanzi: "", pinyin: "", english: "", description: "", categoryId: "", lessonId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newLessonName, setNewLessonName] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
      const uid = data.session?.user?.id ?? "";
      setIsOwner(Boolean(OWNER_USER_ID && uid === OWNER_USER_ID));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      const uid = session?.user?.id ?? "";
      setIsOwner(Boolean(OWNER_USER_ID && uid === OWNER_USER_ID));
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [cr, lr] = await Promise.all([
          fetch("/api/categories", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, credentials: "include" }),
          fetch("/api/lessons", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, credentials: "include" }),
        ]);
        if (cr.ok) { const j = await cr.json(); setCategories(j.categories || []); }
        if (lr.ok) { const j = await lr.json(); setLessons(j.lessons || []); }
      } catch {}
    }
    load();
  }, [accessToken]);

  async function ensureCategory(): Promise<string | null> {
    const name = newCategoryName.trim();
    if (!name) return form.categoryId || null;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ name }),
      credentials: "include",
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.id && j?.name) {
      setCategories((prev) => [{ id: j.id, name: j.name }, ...prev.filter((c) => c.id !== j.id)]);
      setNewCategoryName("");
      return j.id as string;
    }
    return null;
  }

  async function ensureLesson(): Promise<string | null> {
    const name = newLessonName.trim();
    if (!name) return form.lessonId || null;
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ name }),
      credentials: "include",
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.id && j?.name) {
      setLessons((prev) => [{ id: j.id, name: j.name }, ...prev.filter((c) => c.id !== j.id)]);
      setNewLessonName("");
      return j.id as string;
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let category_id: string | null = form.categoryId || null;
      if (!category_id && newCategoryName.trim()) category_id = await ensureCategory();
      let lesson_id: string | null = form.lessonId || null;
      if (!lesson_id && newLessonName.trim()) lesson_id = await ensureLesson();

      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({
          hanzi: form.hanzi,
          pinyin: form.pinyin,
          english: form.english,
          description: form.description,
          category_id,
          lesson_id,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed: ${res.status}`);
      }
      setForm({ hanzi: "", pinyin: "", english: "", description: "", categoryId: "", lessonId: "" });
      setNewCategoryName("");
      setNewLessonName("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add word";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOwner) {
    return <div className="text-sm opacity-70">Sign in as the site owner to add words.</div>;
  }

  return (
    <form onSubmit={onSubmit} className="border rounded p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="border input-theme p-2" placeholder="Hanzi" value={form.hanzi} onChange={(e) => setForm({ ...form, hanzi: e.target.value })} required />
        <input className="border input-theme p-2" placeholder="Pinyin" value={form.pinyin} onChange={(e) => setForm({ ...form, pinyin: e.target.value })} required />
        <input className="border input-theme p-2 sm:col-span-2" placeholder="English" value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} required />
        <textarea className="border input-theme p-2 sm:col-span-2" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Select Category</label>
          <select className="border input-theme p-2 w-full" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <div className="mt-2 flex gap-2">
            <input className="border input-theme p-2 flex-1" placeholder="New Category" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            <button className="px-3 py-2 btn-ghost" type="button" onClick={async () => { const id = await ensureCategory(); if (id) setForm((f) => ({ ...f, categoryId: id })); }} disabled={!newCategoryName.trim() || loading}>Add</button>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Select Lesson</label>
          <select className="border input-theme p-2 w-full" value={form.lessonId} onChange={(e) => setForm({ ...form, lessonId: e.target.value })}>
            <option value="">None</option>
            {lessons.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
          <div className="mt-2 flex gap-2">
            <input className="border input-theme p-2 flex-1" placeholder="New Lesson" value={newLessonName} onChange={(e) => setNewLessonName(e.target.value)} />
            <button className="px-3 py-2 btn-ghost" type="button" onClick={async () => { const id = await ensureLesson(); if (id) setForm((f) => ({ ...f, lessonId: id })); }} disabled={!newLessonName.trim() || loading}>Add</button>
          </div>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button className="px-4 py-2 btn-primary disabled:opacity-60" disabled={loading}>
        {loading ? "Adding..." : "Add Word"}
      </button>
    </form>
  );
}
