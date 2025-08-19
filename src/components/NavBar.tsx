import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/clients";
import { LogoutButton, LoginButton } from "./AuthButtons";

const OWNER_USER_ID = process.env.OWNER_USER_ID || process.env.NEXT_PUBLIC_OWNER_USER_ID || "";

export default async function NavBar() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(user && OWNER_USER_ID && user.id === OWNER_USER_ID);

  return (
    <nav className="w-full flex items-center justify-between py-4">
      <div className="flex gap-4 items-center">
        <Link href="/" className="font-semibold">Chinese Learning</Link>
        <Link href="/words" className="hover:underline">Words</Link>
        <Link href="/categories" className="hover:underline">Categories</Link>
        <Link href="/flashcards" className="hover:underline">Flashcards</Link>
        <Link href="/import" className="hover:underline">Import</Link>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            {isOwner ? <span className="text-xs px-2 py-0.5 rounded bg-black/5">Admin</span> : null}
            <span className="text-sm opacity-75">{user.email}</span>
            <LogoutButton />
          </>
        ) : (
          <LoginButton />
        )}
      </div>
    </nav>
  );
}
