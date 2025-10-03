import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

type Row = {
  word_id: string;
  repetitions: number;
  ease: number;
  interval_days: number;
  due_at: string;
  last_grade: number | null;
  updated_at?: string;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("review_srs")
    .select("word_id,repetitions,ease,interval_days,due_at,last_grade,updated_at")
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ srs: (data ?? []) as Row[] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const rows = Array.isArray(body?.srs) ? (body.srs as Row[]) : [];
  if (rows.length === 0) return NextResponse.json({ error: "srs array required" }, { status: 400 });

  const upserts = rows.map((r) => ({
    user_id: user.id,
    word_id: r.word_id,
    repetitions: r.repetitions,
    ease: r.ease,
    interval_days: r.interval_days,
    due_at: r.due_at,
    last_grade: r.last_grade,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("review_srs")
    .upsert(upserts, { onConflict: "user_id,word_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}


