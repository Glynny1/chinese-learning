"use client";

import Papa, { ParseResult } from "papaparse";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const OWNER_USER_ID = process.env.NEXT_PUBLIC_OWNER_USER_ID || "";

type Row = { hanzi: string; pinyin: string; english: string; description?: string; categoryName?: string };
type Category = { id: string; name: string };

export default function ImportPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
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
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories", {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          credentials: "include",
        });
        if (res.ok) {
          const j = await res.json();
          setCategories(j.categories || []);
        }
      } catch {}
    }
    if (accessToken && isOwner) loadCategories();
  }, [accessToken, isOwner]);

  async function ensureCategoryByName(name: string): Promise<string | null> {
    const clean = name.trim();
    if (!clean) return null;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ name: clean }),
      credentials: "include",
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.id && j?.name) {
      setCategories((prev) => [{ id: j.id, name: j.name }, ...prev.filter((c) => c.id !== j.id)]);
      return j.id as string;
    }
    return null;
  }

  async function ensureCategory(): Promise<string | null> {
    if (!newCategoryName.trim()) return categoryId || null;
    const id = await ensureCategoryByName(newCategoryName);
    if (id) {
      setNewCategoryName("");
      setCategoryId(id);
    }
    return id;
  }

  async function importRows(rows: Array<Row>) {
    let count = 0;

    // Resolve default category once (if any)
    let defaultCategoryId: string | null = categoryId || null;
    if (!defaultCategoryId && newCategoryName.trim()) {
      defaultCategoryId = await ensureCategory();
    }

    // Prepare unique per-row category names to upsert
    const uniqueNames = new Set<string>();
    for (const r of rows) {
      const name = (r.categoryName || "").trim();
      if (name) uniqueNames.add(name);
    }

    const nameToId = new Map<string, string>();
    for (const name of uniqueNames) {
      const id = await ensureCategoryByName(name);
      if (id) nameToId.set(name, id);
    }

    for (const row of rows) {
      const hanzi = row.hanzi?.trim();
      const pinyin = row.pinyin?.trim();
      const english = row.english?.trim();
      const description = (row.description || "").trim();
      if (!hanzi || !pinyin || !english) continue;

      const perRowCategoryId = row.categoryName ? nameToId.get(row.categoryName.trim()) || null : null;
      const finalCategoryId = perRowCategoryId ?? defaultCategoryId;

      const res = await fetch("/api/words", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ hanzi, pinyin, english, description, category_id: finalCategoryId }),
        credentials: "include",
      });
      if (res.ok) count += 1;
    }
    return count;
  }

  function parseObsidian(md: string): Row[] {
    const lines = md.split(/\r?\n/).map((l) => l.trim());
    // Try to derive english from a title like: "1. Day - hào - 号" → "Day"
    const titleLine = lines.find((l) => /\S/.test(l)) || "";
    let english = "";
    const titleMatch = titleLine.match(/^[#*\d.\s-]*([^\-#*]+?)\s*-\s*[^-]+-\s*[^-]+$/);
    if (titleMatch) english = titleMatch[1].trim();

    let hanzi = "";
    let pinyin = "";
    let meaning = "";
    let pronTip = "";
    let categoryName = "";

    for (const l of lines) {
      const kv = l.split(":");
      if (kv.length >= 2) {
        const key = kv[0].toLowerCase().trim();
        const value = kv.slice(1).join(":").trim();
        if (key.startsWith("character")) hanzi = value;
        else if (key.startsWith("pinyin")) pinyin = value;
        else if (key.startsWith("meaning")) meaning = value.replace(/^[-–]\s*/, "");
        else if (key.startsWith("pronunciation tip")) pronTip = value;
        else if (key.startsWith("category")) categoryName = value;
      }
    }

    const description = [meaning, pronTip].filter(Boolean).join("\n");
    if (!english && meaning) {
      english = meaning.split(/[,;\-]/)[0].trim();
    }
    if (hanzi && pinyin && english) {
      return [{ hanzi, pinyin, english, description, categoryName }];
    }
    return [];
  }

  async function onImportCSV() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const content = await file.text();
      const parsed: ParseResult<Record<string, unknown>> = Papa.parse<Record<string, unknown>>(content, { header: true });
      const rows: Row[] = [];
      for (const r of (parsed.data || []) as Array<Record<string, unknown>>) {
        if (!r) continue;
        const get = (k: string) => (r[k] as string | undefined) ?? "";
        const hanzi = get("hanzi") || get("Hanzi") || get("character") || get("Character");
        const pinyin = get("pinyin") || get("Pinyin");
        const english = get("english") || get("English") || get("meaning") || get("Meaning");
        const description = get("description") || get("Description") || get("notes") || get("Notes");
        const categoryName = get("category") || get("Category") || get("Category Name") || get("group") || get("Group");
        if (hanzi && pinyin && english) rows.push({ hanzi, pinyin, english, description, categoryName });
      }
      const count = await importRows(rows);
      setImported(count);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import CSV";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onImportMarkdown() {
    setLoading(true);
    setError(null);
    try {
      const rows: Row[] = [];
      const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
      for (const block of blocks) {
        const fromObsidian = parseObsidian(block);
        if (fromObsidian.length) {
          rows.push(...fromObsidian);
          continue;
        }
        // Fallback simple row formats
        const pipe = block.split("|").map((s) => s.trim());
        const dash = block.split("-").map((s) => s.trim());
        if (pipe.length >= 3) {
          const [hanzi, pinyin, english, description, categoryName] = [pipe[0], pipe[1], pipe[2], pipe[3] || "", pipe[4] || ""];
          rows.push({ hanzi, pinyin, english, description, categoryName });
        } else if (dash.length >= 3) {
          const [hanzi, pinyin, english] = [dash[0], dash[1], dash[2]];
          const rest = dash.slice(3);
          const description = rest[0] || "";
          const categoryName = rest.slice(1).join(" - ");
          rows.push({ hanzi, pinyin, english, description, categoryName });
        }
      }
      const count = await importRows(rows);
      setImported(count);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import Markdown";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOwner) {
    return <div className="max-w-2xl mx-auto w-full"><h1 className="text-2xl font-semibold mb-4">Bulk Import</h1><div className="opacity-70">Admins only.</div></div>;
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Bulk Import</h1>

      <div className="border rounded p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Default Category</label>
            <select className="border rounded p-2 w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Or Create New Category</label>
            <div className="flex gap-2">
              <input className="border rounded p-2 flex-1" placeholder="e.g., Greeting" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
              <button className="px-3 py-2 rounded border" type="button" onClick={ensureCategory} disabled={!newCategoryName.trim() || loading}>Add</button>
            </div>
          </div>
        </div>

        <div>
          <div className="font-medium mb-1">CSV Import</div>
          <p className="text-xs opacity-70 mb-2">Columns supported: hanzi, pinyin, english, description, <strong>category</strong> (optional). If a row has a category, it will be created if needed.</p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="ml-2 px-3 py-1 rounded border" onClick={onImportCSV} disabled={!file || loading}>
            Import CSV
          </button>
        </div>
        <div>
          <div className="font-medium mb-1">Markdown / Obsidian Import</div>
          <p className="text-xs opacity-70 mb-2">Supports simple rows and Obsidian fields (Character:, Pinyin:, Meaning:, Pronunciation Tip:, <strong>Category:</strong>). Meaning is stored as description. You can also append category as a 5th field in pipe rows.</p>
          <textarea className="border rounded p-2 w-full h-40" placeholder="Paste notes or rows here" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="mt-2 px-3 py-1 rounded border" onClick={onImportMarkdown} disabled={loading}>
            Import Markdown
          </button>
        </div>
        {imported !== null && <div className="text-green-600">Imported {imported} rows.</div>}
        {error && <div className="text-red-600">{error}</div>}
      </div>
    </div>
  );
}
