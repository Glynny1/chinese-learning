# Chinese Learning – Public Flashcards

A free, public resource of Chinese vocabulary curated from my learning. Browse words, read notes, and study with flashcards. No login required for visitors.

## What you can do
- Learn words with Hanzi, Pinyin, English, and short notes
- Filter by Category and Lesson (e.g., Small Talk, Lesson 1)
- Practice with smart flashcards:
  - Randomized first card
  - Category/Lesson filters
  - Spaced repetition (Again/Hard/Good/Easy with 1–4 shortcuts)
  - Local progress saved in your browser (no account needed)

## How to use
- Go to Words to explore and read notes
- Go to Flashcards, optionally pick a Category and/or Lesson, and start reviewing
- Use 1–4 to grade your recall; your due cards will be scheduled automatically

---

## About
- Content is curated and added by the site owner; visitors have read-only access
- Progress is stored privately on your device (localStorage)

## For developers / self‑hosting
If you want to run your own copy, this is a Next.js app with a Postgres backend. You’ll need to provide your own database and authentication.

Basic steps:
1) Set env vars in `.env.local` (database URL and keys)
2) Apply SQL in `supabase/schema.sql`
3) `npm install && npm run dev`

See the codebase for details. This repo intentionally hides infrastructure details from visitors; it’s focused on the learning experience.
