import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, hanzi, pinyin, english, description, category_id, conversation_order, type")
    .order("conversation_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}


