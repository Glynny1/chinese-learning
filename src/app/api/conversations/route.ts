import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

const OWNER_USER_ID = process.env.OWNER_USER_ID || process.env.NEXT_PUBLIC_OWNER_USER_ID || "";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!OWNER_USER_ID) return NextResponse.json({ conversations: [] });
  const { data, error } = await supabase
    .from("conversations")
    .select("id, hanzi, pinyin, english, category_id, conversation_order, type")
    .eq("user_id", OWNER_USER_ID)
    .order("conversation_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}


