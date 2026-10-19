"use client";

import clsx from "clsx";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  History,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CourseBadge, Tag } from "@/components/ui/badges";
import { api } from "@/components/ui/api";
import { formatDate } from "@/lib/dates";
import type { Course, PracticeSession, QuizQuestion } from "@/lib/types";
import PasteQuizModal from "./PasteQuizModal";
import QuizRunner, { type AnswerRecord } from "./QuizRunner";

type Mode =
  | { kind: "idle" }
  | { kind: "running"; questions: QuizQuestion[]; source: "bank" | "ai_variation"; key: number }
  | { kind: "results"; answers: AnswerRecord[]; source: "bank" | "ai_variation"; saved: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticeClient({
  courses,
  initialQuestions,
  initialSessions,
  initialCourse,
}: {
  courses: Course[];
  initialQuestions: QuizQuestion[];
  initialSessions: PracticeSession[];
  initialCourse?: string;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [sessions, setSessions] = useState(initialSessions);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions) m.set(q.course_code, (m.get(q.course_code) ?? 0) + 1);
    return m;
  }, [questions]);

  const courseCodes = useMemo(() => {
    const set = new Set([...courses.map((c) => c.course_code), ...counts.keys()]);
    return [...set].sort();
  }, [courses, counts]);

  const [course, setCourse] = useState<string>(
    initialCourse && courseCodes.includes(initialCourse)
      ? initialCourse
      : (courseCodes.find((c) => (counts.get(c) ?? 0) > 0) ?? courseCodes[0] ?? ""),
  );
  const [size, setSize] = useState<number>(10);
  const [tag, setTag] = useState<string>("all");
  const [saveVariations, setSaveVariations] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });

  const courseQuestions = useMemo(() => questions.filter((q) => q.course_code === course), [questions, course]);
  const tags = useMemo(() => [...new Set(courseQuestions.flatMap((q) => q.tags))].sort(), [courseQuestions]);
  const pool = tag === "all" ? courseQuestions : courseQuestions.filter((q) => q.tags.includes(tag));
  const courseName = courses.find((c) => c.course_code === course)?.name;

  function start(list: QuizQuestion[], source: "bank" | "ai_variation") {
    setError(null);
    setMode({ kind: "running", questions: list, source, key: Date.now() });
  }

  async function generateVariation(fromIds?: string[]) {
    if (!course) return;
    setGenerating(true);
    setError(null);
    try {
      const realIds = fromIds?.filter((id) => !id.startsWith("tmp-"));
      const res = await api<{ questions: QuizQuestion[] }>("/api/generate-variation", {
        body: { course_code: course, question_ids: realIds?.length ? realIds : undefined, count: 5, save: saveVariations },
      });
      if (saveVariations) setQuestions((prev) => [...res.questions, ...prev]);
      if (res.questions.length) start(res.questions, "ai_variation");
      else setError("The AI didn't return any questions. Try again.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function finish(answers: AnswerRecord[], source: "bank" | "ai_variation") {
    setMode({ kind: "results", answers, source, saved: false });
    try {
      const { session } = await api<{ session: PracticeSession }>("/api/practice-sessions", {
        body: {
          course_code: course,
          score: answers.filter((a) => a.correct).length,
          total_questions: answers.length,
          missed_tags: answers.filter((a) => !a.correct).flatMap((a) => a.question.tags),
          mode: source,
        },
      });
      setSessions((prev) => [session, ...prev].slice(0, 10));
      setMode({ kind: "results", answers, source, saved: true });
    } catch (err) {
      setError(`Couldn't save this session: ${(err as Error).message}`);
    }
  }

  async function deleteQuestion(q: QuizQuestion) {
    if (!confirm("Delete this question from the vault?")) return;
    const before = questions;
    setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    try {
      await api(`/api/quiz/${q.id}`, { method: "DELETE" });
    } catch (err) {
      setQuestions(before);
      setError((err as Error).message);
    }
  }

  // ─── Running ────────────────────────────────────────────────────────────
  if (mode.kind === "running") {
    return (
      <QuizRunner
        key={mode.key}
        questions={mode.questions}
        title={`${course}${courseName ? ` · ${courseName}` : ""}${mode.source === "ai_variation" ? " · AI Variation Quiz" : ""}`}
        onExit={() => setMode({ kind: "idle" })}
        onFinish={(answers) => finish(answers, mode.source)}
      />
    );
  }

  // ─── Results ────────────────────────────────────────────────────────────
  if (mode.kind === "results") {
    const score = mode.answers.filter((a) => a.correct).length;
    const pct = Math.round((score / mode.answers.length) * 100);
    const missed = mode.answers.filter((a) => !a.correct);
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card p-6 text-center">
          <Trophy className={clsx("mx-auto h-10 w-10", pct >= 80 ? "text-gold-500" : pct >= 50 ? "text-slate-400" : "text-tu-400")} />
          <p className="mt-2 text-3xl font-bold">
            {score}/{mode.answers.length}
          </p>
          <p className="text-sm text-slate-500">
            {pct}% · {mode.saved ? "Saved to your history" : "Saving…"}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button className="btn-secondary" onClick={() => setMode({ kind: "idle" })}>
              Back to vault
            </button>
            <button className="btn-secondary" onClick={() => start(shuffle(mode.answers.map((a) => a.question)), mode.source)}>
              <RotateCcw className="h-4 w-4" /> Retry same set
            </button>
            <button
              className="btn-primary"
              disabled={generating}
              onClick={() => generateVariation((missed.length ? missed : mode.answers).map((a) => a.question.id))}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : missed.length ? "AI Variations of Missed Questions" : "Generate AI Variation Quiz"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <ul className="mt-4 space-y-2">
          {mode.answers.map((a, i) => (
            <li key={i} className="card flex items-start gap-3 p-3">
              {a.correct ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              )}
              <div className="min-w-0 text-sm">
                <p className="line-clamp-2 text-slate-800">{a.question.question_text}</p>
                {!a.correct && (
                  <p className="mt-1 text-xs text-slate-500">
                    Answer: <span className="font-medium text-emerald-700">{a.question.correct_answer}</span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ─── Idle: vault overview ───────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quiz Vault</h1>
          <p className="text-sm text-slate-500">{questions.length} saved questions across {counts.size} courses</p>
        </div>
        <button className="btn-primary" onClick={() => setPasteOpen(true)}>
          <ClipboardPaste className="h-4 w-4" /> Drop / Paste Quiz
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {courseCodes.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCourse(c);
              setTag("all");
            }}
            className={clsx(course === c ? "chip-on" : "chip-off", "font-mono")}
          >
            {c}
            <span className={clsx("rounded-full px-1.5 text-[10px]", course === c ? "bg-white/20" : "bg-slate-100")}>
              {counts.get(c) ?? 0}
            </span>
          </button>
        ))}
        {courseCodes.length === 0 && <p className="text-sm text-slate-500">Add a course or paste a quiz to get started.</p>}
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Practice setup */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-tu-600" />
            <h2 className="font-semibold">
              Practice {course || "—"}
              {courseName && <span className="font-normal text-slate-500"> · {courseName}</span>}
            </h2>
          </div>

          {courseQuestions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No questions for this course yet. Use <strong>Drop / Paste Quiz</strong> to add some.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Topic</label>
                  <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
                    <option value="all">All topics ({courseQuestions.length})</option>
                    {tags.map((t) => (
                      <option key={t} value={t}>
                        {t} ({courseQuestions.filter((q) => q.tags.includes(t)).length})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Questions</label>
                  <select className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                    {[5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                    <option value={10_000}>All</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="btn-primary" disabled={!pool.length} onClick={() => start(shuffle(pool).slice(0, size), "bank")}>
                  <Play className="h-4 w-4" /> Start practice ({Math.min(size, pool.length)})
                </button>
                <button
                  className="btn-secondary"
                  disabled={generating}
                  onClick={() => generateVariation(tag === "all" ? undefined : pool.map((q) => q.id).slice(0, 30))}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-gold-600" />}
                  {generating ? "AI is writing…" : "Generate AI Variation Quiz"}
                </button>
                <label className="ml-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={saveVariations}
                    onChange={(e) => setSaveVariations(e.target.checked)}
                    className="rounded border-slate-300 text-tu-600 focus:ring-tu-500"
                  />
                  Save variations to vault
                </label>
              </div>
            </>
          )}
        </div>

        {/* History */}
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500" />
            <h2 className="font-semibold">Recent sessions</h2>
          </div>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No practice sessions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sessions.map((s) => {
                const pct = Math.round((s.score / s.total_questions) * 100);
                return (
                  <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CourseBadge code={s.course_code} />
                        <span className="text-xs text-slate-400">{formatDate(s.created_at)}</span>
                      </div>
                      {s.summary && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.summary}</p>}
                    </div>
                    <span
                      className={clsx(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold",
                        pct >= 80 ? "bg-emerald-50 text-emerald-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700",
                      )}
                    >
                      {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Question bank */}
      {courseQuestions.length > 0 && (
        <section className="mt-5">
          <button onClick={() => setBankOpen((o) => !o)} className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ChevronDown className={clsx("h-4 w-4 transition", !bankOpen && "-rotate-90")} />
            Question bank · {course}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{pool.length}</span>
          </button>
          {bankOpen && (
            <ul className="card divide-y divide-slate-100">
              {pool.map((q) => (
                <li key={q.id} className="group flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-slate-800">{q.question_text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-medium uppercase text-slate-400">{q.question_type === "mcq" ? "MCQ" : "Open"}</span>
                      {q.source === "ai_variation" && <Tag>AI</Tag>}
                      {q.tags
                        .filter((t) => t !== "ai-variation")
                        .map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteQuestion(q)}
                    className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <PasteQuizModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        courses={courseCodes}
        defaultCourse={course}
        onCreated={(created) => {
          setQuestions((prev) => [...created, ...prev]);
          if (created[0]) setCourse(created[0].course_code);
        }}
      />
    </div>
  );
}
