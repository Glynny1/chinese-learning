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
    <nav className="w-full flex items-center justify-between py-4">
      <div className="flex gap-4 items-center">
        <Link href="/" className="font-semibold">Chinese Learning</Link>
        <Link href="/words" className="hover:underline">Words</Link>
        <Link href="/categories" className="hover:underline">Categories</Link>
        <Link href="/flashcards" className="hover:underline">Flashcards</Link>
        {isOwner ? <Link href="/import" className="hover:underline">Import</Link> : null}
      </div>
      <div className="flex items-center gap-3">
        {email ? (
          <>
            {isOwner ? <span className="text-xs px-2 py-0.5 rounded bg-black/5">Admin</span> : null}
            <span className="text-sm opacity-75">{email}</span>
            <LogoutButton />
          </>
        ) : (
          <LoginButton />
        )}
      </div>
    </nav>
  );
}
