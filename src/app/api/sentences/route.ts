import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sentences")
    .select("id, hanzi, pinyin, english, description, category_id")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sentences: data ?? [] });
}


