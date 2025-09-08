"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LogoutButton, LoginButton } from "./AuthButtons";

const OWNER_USER_ID = process.env.NEXT_PUBLIC_OWNER_USER_ID || "";

export default function NavBarClient() {
  const [email, setEmail] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
      const uid = data.session?.user?.id ?? "";
      setIsOwner(Boolean(OWNER_USER_ID && uid === OWNER_USER_ID));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      const uid = session?.user?.id ?? "";
      setIsOwner(Boolean(OWNER_USER_ID && uid === OWNER_USER_ID));
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/90 border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex gap-3 sm:gap-4 items-center">
          <Link href="/" className="font-semibold tracking-tight hover:opacity-80 transition">Chinese Learning</Link>
          <Link href="/words" className="px-2 py-1 rounded hover:bg-black/5 transition">Words</Link>
          <Link href="/flashcards" className="px-2 py-1 rounded hover:bg-black/5 transition">Flashcards</Link>
          {isOwner ? <Link href="/import" className="px-2 py-1 rounded hover:bg-black/5 transition">Import</Link> : null}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {email ? (
            <>
              {isOwner ? <span className="text-xs px-2 py-0.5 rounded-full bg-black/5">Admin</span> : null}
              <span className="hidden sm:inline text-sm opacity-75">{email}</span>
              <LogoutButton />
            </>
          ) : (
            <LoginButton />
          )}
        </div>
      </div>
    </nav>
  );
}
