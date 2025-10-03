import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

type Flag = "again" | "hard";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("review_flags")
    .select("word_id, flag, created_at, words:word_id(id, hanzi, pinyin, english)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flags: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const word_id = (body?.word_id || "").trim();
  const flag = (body?.flag || "").trim() as Flag;
  if (!word_id || (flag !== "again" && flag !== "hard")) {
    return NextResponse.json({ error: "word_id and flag required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("review_flags")
    .upsert({ user_id: user.id, word_id, flag, created_at: new Date().toISOString() }, { onConflict: "user_id,word_id" })
    .select("word_id, flag")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ word_id: data?.word_id, flag: data?.flag }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let word_id = "";
  try {
    const body = await request.json();
    word_id = (body?.word_id || "").trim();
  } catch {}
  if (!word_id) return NextResponse.json({ error: "word_id required" }, { status: 400 });

  const { error } = await supabase
    .from("review_flags")
    .delete()
    .eq("user_id", user.id)
    .eq("word_id", word_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}


