import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

const OWNER_USER_ID = process.env.OWNER_USER_ID || process.env.NEXT_PUBLIC_OWNER_USER_ID || "";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!OWNER_USER_ID) return NextResponse.json({ categories: [] });
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", OWNER_USER_ID)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !OWNER_USER_ID || user.id !== OWNER_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const name = (body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const insert = await supabase
    .from("categories")
    .insert({ user_id: user.id, name })
    .select("id, name").single();

  if (insert.error) {
    const { data: existing, error: selErr } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("name", name)
      .single();
    if (existing) return NextResponse.json(existing, { status: 200 });
    return NextResponse.json({ error: (selErr || insert.error).message }, { status: 500 });
  }

  return NextResponse.json(insert.data, { status: 201 });
}

 