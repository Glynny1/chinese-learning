-- Extensions
create extension if not exists "pgcrypto";

-- Tables
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  hanzi text not null,
  pinyin text not null,
  english text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.categories enable row level security;
alter table public.words enable row level security;

-- Policies: public can SELECT owner content; only owner can INSERT/UPDATE/DELETE
-- Replace YOUR_OWNER_UUID with your actual user UUID
-- You can set this as a Postgres setting for flexibility, but here we inline it.

create policy if not exists "Public read owner's categories" on public.categories
  for select using (user_id = 'YOUR_OWNER_UUID'::uuid);

create policy if not exists "Owner manages categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "Public read owner's words" on public.words
  for select using (user_id = 'YOUR_OWNER_UUID'::uuid);

create policy if not exists "Owner manages words" on public.words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Indexes
create index if not exists idx_categories_user on public.categories(user_id);
create unique index if not exists uniq_categories_user_name on public.categories(user_id, name);
create index if not exists idx_words_user on public.words(user_id);
create index if not exists idx_words_category on public.words(category_id);
