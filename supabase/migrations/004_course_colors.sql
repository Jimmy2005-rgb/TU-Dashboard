-- ════════════════════════════════════════════════════════════════════════
--  004 — Course colours: an optional colour slot (1–7) chosen per course.
--  NULL means "pick automatically". Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
alter table public.courses
  add column if not exists color smallint check (color is null or color between 1 and 7);
