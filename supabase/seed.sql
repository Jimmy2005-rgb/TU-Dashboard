-- ════════════════════════════════════════════════════════════════════════
--  Optional starter data. Run after schema.sql.
--  Edit course names, professors and semester to match your enrolment.
-- ════════════════════════════════════════════════════════════════════════

insert into public.courses (course_code, name, professor, semester) values
  ('AC201', 'Fundamentals of Financial Accounting', null, '1/2026'),
  ('AC202', 'Managerial Accounting',                null, '1/2026'),
  ('FN201', 'Business Finance',                     null, '1/2026'),
  ('MK201', 'Principles of Marketing',              null, '1/2026'),
  ('OM201', 'Operations Management',                null, '1/2026')
on conflict (course_code) do nothing;

-- A few sample questions so the Practice page has something to show.
insert into public.quiz_bank (course_code, question_text, question_type, options, correct_answer, explanation, tags, source)
select * from (values
  (
    'FN201',
    'You deposit ฿100,000 today in an account paying 6% per year, compounded annually. How much will you have after 5 years?',
    'mcq',
    '["฿130,000", "฿133,823", "฿126,248", "฿141,852"]'::jsonb,
    '฿133,823',
    E'Future value of a lump sum: FV = PV × (1 + r)^n\nFV = 100,000 × (1.06)^5 = 100,000 × 1.338226 = ฿133,823.\n฿130,000 is simple interest (forgetting compounding).',
    array['time-value-of-money', 'future-value'],
    'manual'
  ),
  (
    'FN201',
    'A project costs ฿500,000 today and returns ฿200,000 at the end of each of the next 3 years. At a 10% discount rate, should the firm accept it? Show the NPV.',
    'open_ended',
    '[]'::jsonb,
    'NPV ≈ ฿–2,630, so reject the project.',
    E'NPV = –500,000 + 200,000 × [1 – (1.10)^–3] / 0.10\nAnnuity factor = (1 – 0.751315) / 0.10 = 2.48685\nPV of inflows = 200,000 × 2.48685 = 497,370\nNPV = 497,370 – 500,000 = –2,630 < 0 → reject.',
    array['npv', 'capital-budgeting', 'annuity'],
    'manual'
  ),
  (
    'AC201',
    'A company buys equipment for ฿300,000 with a residual value of ฿30,000 and a useful life of 5 years. What is the annual straight-line depreciation expense?',
    'mcq',
    '["฿60,000", "฿54,000", "฿66,000", "฿50,000"]'::jsonb,
    '฿54,000',
    E'Straight-line depreciation = (Cost – Residual value) / Useful life\n= (300,000 – 30,000) / 5 = ฿54,000 per year.\n฿60,000 ignores the residual value.',
    array['depreciation', 'ppe'],
    'manual'
  )
) as v(course_code, question_text, question_type, options, correct_answer, explanation, tags, source)
where not exists (select 1 from public.quiz_bank where quiz_bank.course_code = v.course_code);
