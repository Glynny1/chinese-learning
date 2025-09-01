import Link from "next/link";
import HomeAdminLink from "@/components/HomeAdminLink";

export default async function Home() {
  // Home is static; admin-only links are handled in the NavBar client component

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-semibold mb-4">欢迎！Huānyíng!</h1>
      <p className="opacity-80">Build your Chinese vocabulary and practice with flashcards.</p>
      <div className="mt-6 grid grid-cols-1 gap-3">
        <Link href="/words" className="border rounded p-4 hover:bg-black/5">View words</Link>
        <Link href="/flashcards" className="border rounded p-4 hover:bg-black/5">Start flashcards</Link>
        <HomeAdminLink />
      </div>
    </div>
  );
}
