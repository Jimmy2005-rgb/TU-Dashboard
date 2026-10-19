-- ════════════════════════════════════════════════════════════════════════
--  TU BBA Academic Hub & Quiz Vault — database schema
--  Run this whole file once in Supabase → SQL Editor → New query → Run.
--  It is idempotent: re-running it is safe.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Shared trigger: keep updated_at current ────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── courses ────────────────────────────────────────────────────────────
create table if not exists public.courses (
  id           uuid primary key default gen_random_uuid(),
  course_code  text not null unique
               check (course_code ~ '^[A-Z]{2,4}[0-9]{3}$'),   -- e.g. FN201, AC201
  name         text not null,
  professor    text,
  semester     text,                                          -- e.g. '1/2026'
  created_at   timestamptz not null default now()
);

-- ─── assignments ────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  course_code      text references public.courses (course_code)
                   on update cascade on delete set null,
  source_platform  text not null default 'manual'
                   check (source_platform in ('ms_teams', 'google_classroom', 'manual')),
  external_id      text,                                      -- id from Teams/Classroom, used to de-duplicate webhooks
  title            text not null check (char_length(title) between 1 and 500),
  description      text,
  due_date         timestamptz,
  status           text not null default 'pending'
                   check (status in ('pending', 'completed')),
  external_link    text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint assignments_external_unique unique (user_id, source_platform, external_id)
);

create index if not exists assignments_user_status_due_idx
  on public.assignments (user_id, status, due_date);
create index if not exists assignments_course_idx
  on public.assignments (course_code);

drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

-- ─── quiz_bank ──────────────────────────────────────────────────────────
create table if not exists public.quiz_bank (
  id              uuid primary key default gen_random_uuid(),
  course_code     text not null references public.courses (course_code)
                  on update cascade on delete cascade,
  question_text   text not null,
  question_type   text not null default 'mcq'
                  check (question_type in ('mcq', 'open_ended')),
  options         jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(options) = 'array'),
  correct_answer  text not null,
  explanation     text,
  tags            text[] not null default '{}',
  source          text not null default 'pasted'
                  check (source in ('pasted', 'ai_variation', 'manual')),
  created_at      timestamptz not null default now()
);

create index if not exists quiz_bank_course_idx on public.quiz_bank (course_code, created_at);
create index if not exists quiz_bank_tags_idx on public.quiz_bank using gin (tags);

-- ─── practice_sessions ──────────────────────────────────────────────────
create table if not exists public.practice_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  course_code      text references public.courses (course_code)
                   on update cascade on delete set null,
  score            integer not null check (score >= 0),
  total_questions  integer not null check (total_questions > 0),
  summary          text,
  created_at       timestamptz not null default now(),
  constraint practice_score_le_total check (score <= total_questions)
);

create index if not exists practice_sessions_user_idx
  on public.practice_sessions (user_id, created_at desc);

-- ─── course_materials (links/notes shown in the Course Resource Hub) ────
create table if not exists public.course_materials (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  course_code  text not null references public.courses (course_code)
               on update cascade on delete cascade,
  title        text not null,
  url          text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists course_materials_course_idx
  on public.course_materials (course_code, created_at desc);

-- ════════════════════════════════════════════════════════════════════════
--  Row Level Security
--  The Next.js server talks to Supabase with the service role key, which
--  bypasses RLS. The policies below lock out the public `anon` role entirely
--  and only let a signed-in Supabase Auth user touch their own rows — so the
--  schema stays safe if you later add Supabase Auth or a client-side SDK.
-- ════════════════════════════════════════════════════════════════════════

alter table public.courses           enable row level security;
alter table public.assignments       enable row level security;
alter table public.quiz_bank         enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.course_materials  enable row level security;

-- courses & quiz_bank: shared reference data, readable by signed-in users
drop policy if exists "courses_read_authenticated" on public.courses;
create policy "courses_read_authenticated" on public.courses
  for select to authenticated using (true);

drop policy if exists "quiz_bank_read_authenticated" on public.quiz_bank;
create policy "quiz_bank_read_authenticated" on public.quiz_bank
  for select to authenticated using (true);

-- user-owned tables: full access to own rows only
drop policy if exists "assignments_owner_all" on public.assignments;
create policy "assignments_owner_all" on public.assignments
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "practice_sessions_owner_all" on public.practice_sessions;
create policy "practice_sessions_owner_all" on public.practice_sessions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "course_materials_owner_all" on public.course_materials;
create policy "course_materials_owner_all" on public.course_materials
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Belt and braces: the anon role gets no table privileges at all.
revoke all on public.courses, public.assignments, public.quiz_bank,
              public.practice_sessions, public.course_materials from anon;
