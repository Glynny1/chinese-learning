"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginButton() {
  async function onLogin() {
    const supabase = createSupabaseBrowserClient();
    const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const origin = envSiteUrl || window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
  }
  return (
    <button className="px-3 py-1 rounded border" onClick={onLogin}>
      Login with Google
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function onLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
  }
  return (
    <button className="px-3 py-1 rounded border" onClick={onLogout}>
      Logout
    </button>
  );
}
