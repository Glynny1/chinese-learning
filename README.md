# Chinese Learning (Public Resource)

A public, living resource of Chinese vocabulary curated from my personal learning. Visitors can browse words by category, read notes, and practice with built‑in flashcards. I (the owner) can log in to add and organize entries; everyone else has read‑only access.

## What you can do
- View words with Hanzi, Pinyin, English, and descriptions/notes
- Explore categories (e.g., Greetings, Dates & Times)
- Practice with simple flip‑style flashcards
- Import (owner only): bulk add from CSV or Markdown/Obsidian notes

## How it works
- The site is built with Next.js and Supabase.
- Data is stored in Postgres (Supabase) and is publicly readable for a single owner’s dataset.
- Only the owner (me) can sign in and create/update content.

---

## Setup (for developers / self‑hosting)

1. Create a Supabase project (free tier) and enable Google OAuth.
2. Copy your project URL and anon key.
3. Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=YOUR_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Owner account UUID (find after first login at /api/me or Supabase users)
NEXT_PUBLIC_OWNER_USER_ID=YOUR_OWNER_UUID
```
4. Run SQL in Supabase (see `supabase/schema.sql`). Replace `YOUR_OWNER_UUID` in RLS policies with your UUID.
5. `npm run dev` and open `http://localhost:3000`.

### Owner-only writes
- API enforces `OWNER_USER_ID/NEXT_PUBLIC_OWNER_USER_ID` for writes; everyone can read the owner’s data.
- Set your owner UUID in both `.env.local` and the SQL policies.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
