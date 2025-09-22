import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

type Grade = 0 | 1 | 2 | 3;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const itemId = String(body?.itemId || "").trim();
    const mode = String(body?.mode || "words"); // "words" | "conversations"
    const rawGrade = Number(body?.grade);
    const categoryId = body?.categoryId ? String(body.categoryId) : null;
    if (!itemId || !(rawGrade === 0 || rawGrade === 1 || rawGrade === 2 || rawGrade === 3)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      item_id: itemId,
      mode,
      grade: rawGrade as Grade,
      category_id: categoryId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Totals by grade
    const byGrade = await supabase
      .from("reviews")
      .select("grade, count:grade", { count: "exact", head: false })
      .eq("user_id", user.id);
    if (byGrade.error) return NextResponse.json({ error: byGrade.error.message }, { status: 400 });

    // Last 7 days count
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last7 = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);

    // By mode
    const byMode = await supabase
      .from("reviews")
      .select("mode, count:mode", { count: "exact", head: false })
      .eq("user_id", user.id);

    // By category (name optional)
    const catResp = await supabase
      .from("reviews")
      .select("category_id, categories(name)")
      .eq("user_id", user.id);

    const catCounts = new Map<string, { id: string; name: string; count: number }>();
    if (!catResp.error && Array.isArray(catResp.data)) {
      for (const r of catResp.data as Array<{ category_id: string | null; categories?: { name?: string | null } | null }>) {
        if (!r.category_id) continue;
        const name = r.categories?.name || "Category";
        const entry = catCounts.get(r.category_id) || { id: r.category_id, name, count: 0 };
        entry.count += 1;
        catCounts.set(r.category_id, entry);
      }
    }

    return NextResponse.json({
      byGrade: byGrade.data ?? [],
      last7Days: last7.count ?? 0,
      byMode: byMode.data ?? [],
      byCategory: Array.from(catCounts.values()),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


