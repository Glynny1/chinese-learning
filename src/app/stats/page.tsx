"use client";

import { useEffect, useState } from "react";

type GradeRow = { grade: number; count?: number };
type ModeRow = { mode: string; count?: number };
type CatRow = { id: string; name: string; count: number };

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [byGrade, setByGrade] = useState<GradeRow[]>([]);
  const [byMode, setByMode] = useState<ModeRow[]>([]);
  const [byCategory, setByCategory] = useState<CatRow[]>([]);
  const [last7, setLast7] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/reviews", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error(res.status === 401 ? "Sign in to view your stats" : `Failed: ${res.status}`);
        const j = await res.json();
        if (!mounted) return;
        setByGrade(Array.isArray(j.byGrade) ? j.byGrade : []);
        setByMode(Array.isArray(j.byMode) ? j.byMode : []);
        setByCategory(Array.isArray(j.byCategory) ? j.byCategory : []);
        setLast7(typeof j.last7Days === "number" ? j.last7Days : 0);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="p-4">Loading…</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Your Stats</h1>

      <div className="border rounded p-4">
        <div className="opacity-70 text-sm">Last 7 days</div>
        <div className="text-3xl font-semibold">{last7}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <div className="font-medium mb-2">By Grade</div>
          <ul className="space-y-1">
            {byGrade.map((r, i) => (
              <li key={i} className="flex justify-between"><span>{r.grade === 0 ? "Again" : r.grade === 1 ? "Hard" : r.grade === 2 ? "Good" : "Easy"}</span><span className="opacity-70">{r.count ?? 0}</span></li>
            ))}
          </ul>
        </div>
        <div className="border rounded p-4">
          <div className="font-medium mb-2">By Mode</div>
          <ul className="space-y-1">
            {byMode.map((r, i) => (
              <li key={i} className="flex justify-between"><span>{r.mode}</span><span className="opacity-70">{r.count ?? 0}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border rounded p-4">
        <div className="font-medium mb-2">By Category</div>
        <ul className="space-y-1">
          {byCategory.map((c) => (
            <li key={c.id} className="flex justify-between"><span>{c.name}</span><span className="opacity-70">{c.count}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}


