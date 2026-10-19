-- ════════════════════════════════════════════════════════════════════════
--  002 — Grades: course outline weights + your actual scores
--  Run once in Supabase → SQL Editor (already included in schema.sql for
--  new setups). Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- Target grade per course (percent), used for "what do I need" estimates.
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
