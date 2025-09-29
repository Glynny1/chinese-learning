import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // Prepare a response we can attach cookies to
  const origin = requestUrl.origin;
  const redirectTo = NextResponse.redirect(`${origin}/`);

  // Use request cookies for reads, response cookies for writes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: (name, value, options) => redirectTo.cookies.set(name, value, options),
      remove: (name, options) => redirectTo.cookies.set({ name, value: "", ...options, maxAge: 0 }),
    },
  });

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return redirectTo;
}
