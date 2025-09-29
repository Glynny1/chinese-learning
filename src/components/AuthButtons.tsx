"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginButton() {
  async function onLogin() {
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
  }
  return (
    <button className="px-3 py-1 rounded border flex items-center gap-2" onClick={onLogin} aria-label="Sign up with Google">
      {/* Simple Google mark */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4" aria-hidden>
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.602 32.91 29.204 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.884 6.053 29.702 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.651-.389-3.917z"/>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.61 16.108 18.961 14 24 14c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.884 6.053 29.702 4 24 4 16.318 4 9.633 8.337 6.306 14.691z"/>
        <path fill="#4CAF50" d="M24 44c5.132 0 9.81-1.969 13.317-5.182l-6.148-5.205C29.087 35.091 26.66 36 24 36c-5.18 0-9.559-3.11-11.285-7.489l-6.55 5.047C9.457 39.556 16.211 44 24 44z"/>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.016 2.91-3.42 5.218-6.186 6.612l.001.001 6.148 5.205C37.016 41.744 44 36 44 24c0-1.341-.138-2.651-.389-3.917z"/>
      </svg>
      <span>Sign up with Google</span>
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
