import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/clients";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  const supabase = await createSupabaseServerClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Prefer a configured site URL (production) and fall back to the request origin
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || requestUrl.origin;
  return NextResponse.redirect(`${siteUrl}/`);
}
