"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const OWNER_USER_ID = process.env.NEXT_PUBLIC_OWNER_USER_ID || process.env.OWNER_USER_ID || "";

export default function CategoriesForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed: ${res.status}`);
      }
      setName("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add category";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOwner) return null;

  return (
    <form onSubmit={onSubmit} className="border rounded p-4 space-y-3">
      <input className="border rounded p-2" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} required />
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-60" disabled={loading}>
        {loading ? "Adding..." : "Add Category"}
      </button>
    </form>
  );
}
