-- 006: editable letter-grade scale — a default per student, and an optional override per course.
-- Format: [{"letter":"A","min":85},{"letter":"B+","min":80}, … ,{"letter":"F","min":0}]
alter table public.study_settings
  add column if not exists grade_scale jsonb check (grade_scale is null or jsonb_typeof(grade_scale) = 'array');
alter table public.courses
  add column if not exists grade_scale jsonb check (grade_scale is null or jsonb_typeof(grade_scale) = 'array');
