-- 005: 14 course colours, class timetable, semester dates, exams, mistake review.
-- Safe to run more than once.

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
