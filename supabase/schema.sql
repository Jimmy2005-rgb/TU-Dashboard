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

-- ─── Grades (course outline weights + actual scores) ─────────────────────-- Target grade per course (percent), used for "what do I need" estimates.
alter table public.courses
  add column if not exists target_percent numeric(5,2) not null default 80
  check (target_percent between 0 and 100);

-- One row per graded part of a course, e.g. "Midterm exam" 30%.
create table if not exists public.grade_components (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  course_code  text not null references public.courses (course_code)
               on update cascade on delete cascade,
  name         text not null check (char_length(name) between 1 and 200),
  weight       numeric(5,2) not null check (weight >= 0 and weight <= 100),
  description  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists grade_components_course_idx
  on public.grade_components (user_id, course_code, sort_order);

-- Actual results inside a part, e.g. "Quiz 2" 8 / 10.
create table if not exists public.grade_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  component_id  uuid not null references public.grade_components (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  score         numeric(8,2) not null check (score >= 0),
  max_score     numeric(8,2) not null check (max_score > 0),
  taken_on      date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists grade_items_component_idx
  on public.grade_items (component_id, taken_on);

alter table public.grade_components enable row level security;
alter table public.grade_items      enable row level security;

drop policy if exists "grade_components_owner_all" on public.grade_components;
create policy "grade_components_owner_all" on public.grade_components
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "grade_items_owner_all" on public.grade_items;
create policy "grade_items_owner_all" on public.grade_items
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.grade_components, public.grade_items from anon;

-- ─── Course files (uploaded slides, readings, exercises) ────────────────
-- Materials can now be a link/note OR an uploaded file, and are either
-- general course material or an exercise.
alter table public.course_materials
  add column if not exists kind text not null default 'material'
    check (kind in ('material', 'exercise')),
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint check (file_size is null or file_size >= 0),
  add column if not exists mime_type text;

create index if not exists course_materials_kind_idx
  on public.course_materials (course_code, kind, created_at desc);

-- Private bucket for uploaded files (50 MB per file — the Supabase Free plan
-- maximum). No storage policies are added: the browser uploads with one-time
-- signed URLs and downloads with short-lived signed URLs issued by the server,
-- so the bucket is never readable or writable with the public anon key.
insert into storage.buckets (id, name, public, file_size_limit)
values ('course-files', 'course-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- ─── Course colours ─────────────────────────────────────────────────────
alter table public.courses
  add column if not exists color smallint check (color is null or color between 1 and 7);

-- ─── Timetable, exams, mistake review (migration 005) ─────────────────

-- More colours (1–14).
alter table public.courses drop constraint if exists courses_color_check;
alter table public.courses
  add constraint courses_color_check check (color is null or color between 1 and 14);

-- Weekly class times.
create table if not exists public.class_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  course_code  text not null references public.courses (course_code)
               on update cascade on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),   -- 1 = Monday … 7 = Sunday
  start_time   time not null,
  end_time     time not null,
  room         text,
  section      text,
  created_at   timestamptz not null default now(),
  constraint class_slots_time_order check (end_time > start_time)
);
create index if not exists class_slots_user_idx on public.class_slots (user_id, weekday, start_time);

-- Semester dates, used to number classes ("Class 11" → a date).
create table if not exists public.study_settings (
  user_id         uuid primary key,
  semester_start  date,
  semester_end    date,
  -- [{ "start": "2026-10-05", "end": "2026-10-09", "label": "Midterm week" }]
  no_class_days   jsonb not null default '[]'::jsonb check (jsonb_typeof(no_class_days) = 'array'),
  updated_at      timestamptz not null default now()
);

-- Exams (midterm, final, quizzes …).
create table if not exists public.exams (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  course_code   text not null references public.courses (course_code)
                on update cascade on delete cascade,
  kind          text not null default 'other'
                check (kind in ('midterm', 'final', 'quiz', 'presentation', 'other')),
  title         text not null check (char_length(title) between 1 and 200),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  room          text,
  notes         text,
  -- Grade part this exam counts towards (for "need X% for an A").
  component_id  uuid references public.grade_components (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists exams_user_start_idx on public.exams (user_id, starts_at);

-- Spaced review of questions answered wrong (Leitner boxes).
create table if not exists public.question_reviews (
  question_id       uuid primary key references public.quiz_bank (id) on delete cascade,
  user_id           uuid not null,
  course_code       text not null references public.courses (course_code)
                    on update cascade on delete cascade,
  box               smallint not null default 1 check (box between 1 and 5),
  due_at            timestamptz,                -- null once mastered
  wrong_count       integer not null default 0,
  right_count       integer not null default 0,
  last_answered_at  timestamptz not null default now()
);
create index if not exists question_reviews_due_idx on public.question_reviews (user_id, due_at);

alter table public.class_slots      enable row level security;
alter table public.study_settings   enable row level security;
alter table public.exams            enable row level security;
alter table public.question_reviews enable row level security;

drop policy if exists "class_slots_owner_all" on public.class_slots;
create policy "class_slots_owner_all" on public.class_slots
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "study_settings_owner_all" on public.study_settings;
create policy "study_settings_owner_all" on public.study_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "exams_owner_all" on public.exams;
create policy "exams_owner_all" on public.exams
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "question_reviews_owner_all" on public.question_reviews;
create policy "question_reviews_owner_all" on public.question_reviews
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.class_slots, public.study_settings, public.exams, public.question_reviews from anon;

-- ─── Editable grade scale (migration 006) ─────────────────────────────
alter table public.study_settings
  add column if not exists grade_scale jsonb check (grade_scale is null or jsonb_typeof(grade_scale) = 'array');
alter table public.courses
  add column if not exists grade_scale jsonb check (grade_scale is null or jsonb_typeof(grade_scale) = 'array');
