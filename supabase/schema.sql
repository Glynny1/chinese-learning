-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.categories (
  name text,
  user_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.conversations (
  user_id uuid NOT NULL,
  hanzi text,
  pinyin text,
  category_id uuid NOT NULL,
  conversation_order integer NOT NULL,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  english text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT conversations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.lessons (
  user_id uuid NOT NULL,
  name text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.words (
  sentence boolean,
  user_id uuid NOT NULL,
  hanzi text NOT NULL,
  pinyin text NOT NULL,
  english text NOT NULL,
  description text,
  category_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  lesson_id uuid,
  CONSTRAINT words_pkey PRIMARY KEY (id),
  CONSTRAINT words_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT words_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

-- Track per-user flagged cards (Again/Hard)
CREATE TABLE public.review_flags (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  word_id uuid NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  flag text NOT NULL CHECK (flag IN ('again','hard')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_flags_user_word_unique UNIQUE (user_id, word_id)
);

CREATE INDEX review_flags_user_id_idx ON public.review_flags(user_id);
CREATE INDEX review_flags_word_id_idx ON public.review_flags(word_id);

-- Per-user spaced repetition state for words
CREATE TABLE public.review_srs (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  word_id uuid NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  repetitions integer NOT NULL DEFAULT 0,
  ease numeric NOT NULL DEFAULT 2.5,
  interval_days integer NOT NULL DEFAULT 0,
  due_at timestamp with time zone NOT NULL DEFAULT now(),
  last_grade smallint,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_srs_user_word_unique UNIQUE (user_id, word_id)
);

CREATE INDEX review_srs_user_id_idx ON public.review_srs(user_id);
CREATE INDEX review_srs_due_at_idx ON public.review_srs(due_at);