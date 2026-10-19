-- ════════════════════════════════════════════════════════════════════════
--  003 — Course files: upload slides, readings and exercises per course
--  Run once in Supabase → SQL Editor (already included in schema.sql for
--  new setups). Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

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
