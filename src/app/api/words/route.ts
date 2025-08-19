import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

const OWNER_USER_ID = process.env.OWNER_USER_ID || process.env.NEXT_PUBLIC_OWNER_USER_ID || "";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!OWNER_USER_ID) return NextResponse.json({ words: [] });
  const { data, error } = await supabase
    .from("words")
    .select("id, hanzi, pinyin, english, description, category:categories!words_category_id_fkey(id, name)")
    .eq("user_id", OWNER_USER_ID)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ words: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !OWNER_USER_ID || user.id !== OWNER_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { hanzi, pinyin, english, description, category_id } = body ?? {};
  if (!hanzi || !pinyin || !english) {
    return NextResponse.json({ error: "hanzi, pinyin, english required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("words")
    .insert({ user_id: user.id, hanzi, pinyin, english, description: description || null, category_id: category_id || null })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id }, { status: 201 });
}
