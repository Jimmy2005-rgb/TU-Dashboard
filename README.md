# TU BBA Academic Hub & Quiz Vault

A personal web app for Thammasat University BBA students. It brings MS Teams and Google Classroom deadlines into one dashboard, turns pasted quizzes into a practice bank, and gives you an AI tutor for each course.

**Runs for free:** Vercel Hobby, the Supabase Free plan and the Google Gemini API free tier. You can switch the AI to Anthropic Claude (paid) by adding one environment variable.

**Stack:** Next.js 14 (App Router, TypeScript) · Tailwind CSS · Lucide icons · Supabase (Postgres + RLS) · Google Gemini API (free) or Anthropic Claude API · Vercel

---

## Features

| Area | What it does |
|---|---|
| **Dashboard** `/dashboard` | Deadlines grouped by urgency: Overdue, < 48 Hours, This Week, Later, No Due Date. Filter by platform (Teams / Classroom / Manual) or course code. One click marks an item complete, with an optimistic update saved to Supabase. **Quick Add / Paste Syllabus** sends raw text to the AI, which extracts every deadline and saves them. |
| **Quiz Vault** `/practice` | **Drop / Paste Quiz:** paste scraped Google Forms, Moodle or PDF text and the AI turns it into questions, options, answers and step-by-step explanations. **Practice mode** gives instant feedback, explanations and a score, and keeps a history of your sessions. **Generate AI Variation Quiz** writes new numerical or scenario versions of your questions, starting with the ones you missed. |
| **Course Hub** `/courses/[code]` | Course progress, saved materials (links and notes), saved questions, practice average, and a slide-over **AI tutor** set up for that course. It answers in Thai or English. |
| **Grades** (on each course page) | The course's grading breakdown (e.g. Midterm 30%, Final 40%, Quizzes 10%, Project 20%). **Import course outline (AI)** reads the weights and exam dates from a dropped outline PDF or photo, and you review them before saving. Record your actual scores (e.g. Midterm 42/60) to see your grade so far, an estimated TU letter grade, the range you can still finish in, and the average you need on the remaining parts to reach your target. The **Score history** lists your real results and your practice-quiz scores. |
| **File drop** | Paste Syllabus, Paste Quiz and Import course outline accept **PDFs and photos/screenshots** (up to 4 MB) as well as pasted text. |
| **Webhook** `/api/webhooks/incoming-assignment` | Takes JSON from Make.com or n8n, protected by a secret header. You can send structured fields or raw text for the AI to parse. Items are upserted by `external_id`, so retries don't create duplicates. |
| **Access control** | Set `APP_PASSWORD` to put a single password in front of every page and API route. This stops other people from reading your data or using up your AI quota. |

> **AI provider:** the app uses **Google Gemini** (`gemini-3.8-flash`, free tier) when `GEMINI_API_KEY` is set. If you add `ANTHROPIC_API_KEY`, it switches to **Claude** (`claude-sonnet-5-5`, paid). Claude replaces the original spec's `claude-3-5-sonnet`, which Anthropic retired in October 2025. Set `AI_PROVIDER=gemini` or `claude` to force one. The free Gemini tier has per-minute and per-day request limits. If you hit them, the app says so; wait a minute, or set `GEMINI_MODEL=gemini-3.5-flash-lite` for higher limits.

---

## Project structure

```
.
├── app/
│   ├── layout.tsx                  # Root layout + app shell
│   ├── page.tsx                    # → redirects to /dashboard
│   ├── globals.css                 # Tailwind + component classes
│   ├── icon.svg                    # Favicon
│   ├── not-found.tsx
│   ├── login/page.tsx              # Password screen (when APP_PASSWORD is set)
│   ├── dashboard/page.tsx          # Unified deadlines dashboard (server)
│   ├── practice/page.tsx           # Quiz Vault & practice engine (server)
│   ├── courses/
│   │   ├── page.tsx                # Course cards
│   │   └── [code]/page.tsx         # Course resource hub
│   └── api/
│       ├── parse-assignment/route.ts          # AI: text → assignments → DB
│       ├── parse-quiz/route.ts                # AI: quiz text → quiz_bank
│       ├── generate-variation/route.ts        # AI: fresh variations of saved questions
│       ├── tutor/route.ts                     # AI: streaming course tutor
│       ├── practice-sessions/route.ts         # Save a practice result
│       ├── assignments/[id]/route.ts          # PATCH status / DELETE
│       ├── quiz/[id]/route.ts                 # DELETE question
│       ├── courses/route.ts                   # Create / update course
│       ├── courses/[code]/materials/route.ts  # Add material
│       ├── materials/[id]/route.ts            # Delete material
│       ├── auth/login/route.ts                # Password login
│       ├── auth/logout/route.ts
│       └── webhooks/incoming-assignment/route.ts  # Make.com / n8n receiver
├── components/
│   ├── AppShell.tsx                # Sidebar + mobile nav
│   ├── SetupNotice.tsx
│   ├── ui/                         # Modal, badges, fetch helper
│   ├── dashboard/                  # DashboardClient, QuickAddModal
│   ├── practice/                   # PracticeClient, QuizRunner, PasteQuizModal
│   └── courses/                    # CourseDetailClient, TutorPanel, AddCourseButton
├── lib/
│   ├── supabase.ts                 # Server-only Supabase client (service role)
│   ├── ai.ts                       # Picks Gemini or Claude; structured extraction + streaming
│   ├── gemini.ts                   # Google Gemini provider (free tier)
│   ├── claude.ts                   # Anthropic Claude provider (optional, paid)
│   ├── ai-shared.ts                # Shared AI types and errors
│   ├── ai-tasks.ts                 # Prompts: assignments, quizzes, variations, tutor
│   ├── schemas.ts                  # Zod schemas (AI output + request bodies)
│   ├── auth.ts                     # Password gate helpers
│   ├── dates.ts                    # Bangkok-time formatting & urgency buckets
│   ├── http.ts                     # JSON error/validation helpers
│   └── types.ts
├── supabase/
│   ├── schema.sql                  # Tables, indexes, triggers, RLS
│   └── seed.sql                    # Optional sample courses & questions
├── middleware.ts                   # Password gate
├── tailwind.config.js
├── .env.local.example
└── package.json
```

---

## 1. Run it locally

You need **Node.js 18.18 or newer**.

```bash
npm install
```

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` (see [Environment variables](#environment-variables)), set up the database (step 2), then:

```bash
npm run dev
```

Open http://localhost:3000.

---

## 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com) → **New project**. Pick the Singapore region (`ap-southeast-1`), the closest one to Bangkok.
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. The script is idempotent, so running it again is safe.
   - **Already set up before the Grades feature?** Also run [`supabase/migrations/002_grades.sql`](supabase/migrations/002_grades.sql) once. It adds the grades tables; `schema.sql` already includes it for new setups.
3. Optional: run [`supabase/seed.sql`](supabase/seed.sql) the same way to add sample courses (AC201, AC202, FN201, MK201, OM201) and a few practice questions. Edit the names to match your actual enrolment.
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY` (keep this private)

**Security model:** every table has Row Level Security turned on, and the `anon` role has no access at all. The Next.js server is the only thing that talks to the database, and it uses the service role key, which never reaches the browser. The RLS policies (`auth.uid() = user_id`) are already in place if you add Supabase Auth later.

### Tables

| Table | Key columns |
|---|---|
| `courses` | `course_code` (unique, e.g. FN201), `name`, `professor`, `semester` |
| `assignments` | `user_id`, `course_code`, `source_platform` (`ms_teams` / `google_classroom` / `manual`), `external_id`, `title`, `description`, `due_date`, `status` (`pending` / `completed`), `external_link` |
| `quiz_bank` | `course_code`, `question_text`, `question_type` (`mcq` / `open_ended`), `options` (JSONB array), `correct_answer`, `explanation`, `tags` (text[]), `source` |
| `practice_sessions` | `user_id`, `course_code`, `score`, `total_questions`, `summary` |
| `course_materials` | `user_id`, `course_code`, `title`, `url`, `notes` |

---

## 3. Push to GitHub

This repo is already on GitHub at `Jimmy2005-rgb/TU-Dashboard`. For your own copy or a fresh repo:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial commit: TU BBA Academic Hub"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
```

```bash
git push -u origin main
```

`.env.local` is in `.gitignore`. **Never commit your keys.**

---

## 4. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and **Import** your GitHub repository. Vercel detects Next.js automatically.
2. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Supabase |
   | `GEMINI_API_KEY` | free, from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
   | `WEBHOOK_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `APP_PASSWORD` | your login password (**strongly recommended**) |
   | `OWNER_USER_ID` | optional; any fixed UUID, default `00000000-0000-0000-0000-000000000001` |
   | `ANTHROPIC_API_KEY` | optional (paid); switches the AI to Claude |

3. Click **Deploy**. After that, every push to `main` redeploys automatically.
4. Optional: in **Project Settings → Functions**, set the region to **Singapore (sin1)** so the app runs close to Supabase.

> The AI routes allow up to 60–180 s (`maxDuration`). This works on Vercel Hobby with Fluid Compute, which is on by default for new projects. If very long quizzes time out, split the text into smaller pastes.

---

## 5. Connect MS Teams & Google Classroom (Make.com / n8n)

**Endpoint:** `POST https://<your-app>.vercel.app/api/webhooks/incoming-assignment`

**Auth header:** `x-webhook-secret: <WEBHOOK_SECRET>` (or `Authorization: Bearer <WEBHOOK_SECRET>`)

**Structured payload** (one item, or `{ "assignments": [ ... ] }` for a batch of up to 100):

```json
{
  "source_platform": "google_classroom",
  "external_id": "classroom-courseWork-123456",
  "title": "Problem Set 3: Bond Valuation",
  "description": "Questions 1-8 from Chapter 6. Submit as PDF.",
  "due_date": "2026-11-07T23:59:00+07:00",
  "course_code": "FN201",
  "course_name": "Business Finance",
  "external_link": "https://classroom.google.com/c/xxx/a/yyy"
}
```

- `source_platform` accepts `ms_teams`, `teams`, `microsoft_teams`, `google_classroom`, `classroom`.
- `due_date` can be any ISO date. Dates without a timezone are read as Bangkok time, and a date-only value means 23:59 that day.
- If you leave out `course_code`, it is taken from `course_name` when possible (e.g. `"FN201 Business Finance (Sec 1)"` → `FN201`). Unknown courses are created automatically.
- Always send `external_id` (the Classroom courseWork ID or the Teams assignment ID). This lets a retried or repeated scenario update the existing row instead of adding a duplicate.

**Unstructured payload:** forward an email or Teams message and the AI extracts the tasks:

```json
{ "source_platform": "ms_teams", "external_id": "teams-msg-789", "raw_text": "Hi class, the AC201 case report is due next Friday..." }
```

**Test it:**

```bash
curl -X POST https://<your-app>.vercel.app/api/webhooks/incoming-assignment -H "Content-Type: application/json" -H "x-webhook-secret: $WEBHOOK_SECRET" -d '{"source_platform":"teams","title":"Test item","due_date":"2026-11-07","course_code":"FN201","external_id":"test-1"}'
```

### Make.com recipe

1. Trigger: **Google Classroom → Watch Course Work**, or **Microsoft Teams → Watch Channel Messages** / Microsoft 365 Email → Watch Emails.
2. Action: **HTTP → Make a request**. Method `POST`, URL as above, header `x-webhook-secret`, body type `Raw / JSON`, then map the fields (`title` ← title, `due_date` ← due date, `external_id` ← ID, `external_link` ← alternateLink).

### n8n recipe

1. Trigger: **Google Classroom** node (Course Work → Get Many, on a Schedule trigger) or a **Microsoft Teams / Outlook Trigger** node.
2. **HTTP Request** node: POST, *Send Headers* → `x-webhook-secret`, *Send Body* → JSON with the fields above. For Teams messages, send `raw_text` and let the AI parse it.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-side DB access (bypasses RLS; never expose it) |
| `GEMINI_API_KEY` | ✅ (or Claude) | Free Google Gemini API key |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-3.8-flash` |
| `ANTHROPIC_API_KEY` | Optional | Paid Claude API; used instead of Gemini when set |
| `AI_PROVIDER` | Optional | `gemini` or `claude` to force a provider |
| `WEBHOOK_SECRET` | ✅ for webhooks | Shared secret for Make.com / n8n |
| `APP_PASSWORD` | Recommended | Password-protects the app. If unset, the app is open to anyone with the URL. |
| `OWNER_USER_ID` | Optional | UUID stored in `user_id` columns |
| `CLAUDE_MODEL` | Optional | Defaults to `claude-sonnet-5-5` |

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
