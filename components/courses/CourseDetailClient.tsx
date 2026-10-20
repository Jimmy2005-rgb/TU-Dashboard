"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Circle,
  History,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PlatformBadge, Tag } from "@/components/ui/badges";
import RichText from "@/components/ui/RichText";
import { formatDate, formatDue } from "@/lib/dates";
import { fmtPct, letterFor, summarize } from "@/lib/grades";
import { plural, shortTitle } from "@/lib/text";
import type { Assignment, Course, CourseMaterial, GradeComponent, GradeItem, PracticeSession, QuizQuestion } from "@/lib/types";
import AssignmentModal from "@/components/AssignmentModal";
import { useCourseColorClass } from "@/components/CourseColors";
import AddAssignmentModal from "@/components/dashboard/AddAssignmentModal";
import QuickAddModal from "@/components/dashboard/QuickAddModal";
import AddCourseButton from "./AddCourseButton";
import MaterialsPanel from "./MaterialsPanel";
import GradesPanel from "./GradesPanel";
import TutorPanel from "./TutorPanel";

export default function CourseDetailClient({
  course,
  assignments,
  initialMaterials,
  questions,
  sessions,
  gradeComponents,
  gradeItems,
  allCourses,
  aiEnabled,
}: {
  course: Course;
  assignments: Assignment[];
  initialMaterials: CourseMaterial[];
  questions: QuizQuestion[];
  sessions: PracticeSession[];
  gradeComponents: GradeComponent[];
  gradeItems: GradeItem[];
  allCourses: string[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const courseColor = useCourseColorClass(course.course_code);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [list, setList] = useState(assignments);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  useEffect(() => setList(assignments), [assignments]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const done = assignments.filter((a) => a.status === "completed").length;
  const pct = assignments.length ? Math.round((done / assignments.length) * 100) : 0;
  const upcoming = assignments.filter((a) => a.status === "pending");
  const grade = useMemo(() => summarize(gradeComponents, gradeItems), [gradeComponents, gradeItems]);
  const componentName = useMemo(() => new Map(gradeComponents.map((c) => [c.id, c.name])), [gradeComponents]);
  const results = useMemo(
    () => [...gradeItems].sort((a, b) => (b.taken_on ?? b.created_at).localeCompare(a.taken_on ?? a.created_at)),
    [gradeItems],
  );
  const avgScore = sessions.length
    ? Math.round((sessions.reduce((s, x) => s + x.score / x.total_questions, 0) / sessions.length) * 100)
    : null;


  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${courseColor} flex items-center gap-2 font-mono text-sm font-bold text-slate-500`}>
            <span className="course-dot h-2.5 w-2.5" />
            {course.course_code}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
          <p className="text-sm text-slate-500">
            {[course.professor, course.semester && `Semester ${course.semester}`].filter(Boolean).join(" · ") || "Add professor & semester via Edit course"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddCourseButton existing={course} />
          <Link href={`/practice?course=${course.course_code}`} className="btn-secondary">
            <Play className="h-4 w-4" /> Practice
          </Link>
          <button
            className="btn-primary"
            onClick={() => setTutorOpen(true)}
            disabled={!aiEnabled}
            title={aiEnabled ? undefined : "AI is off: add a free GEMINI_API_KEY in Vercel to turn it on"}
          >
            <Bot className="h-4 w-4" /> Ask Tutor
            {!aiEnabled && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase">off</span>}
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div data-calm="hide" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Course progress" value={`${pct}%`} sub={`${done}/${assignments.length} assignments`}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-tu-600" style={{ width: `${pct}%` }} />
          </div>
        </Stat>
        <Stat
          label="Grade so far"
          value={grade.currentPercent == null ? "—" : `${fmtPct(grade.currentPercent, 0)} ${letterFor(grade.currentPercent)}`}
          sub={grade.gradedWeight > 0 ? `${fmtPct(grade.gradedWeight, 0)} of course graded` : "add scores below"}
        />
        <Stat label="Saved questions" value={String(questions.length)} sub="in the vault" />
        <Stat label="Practice avg" value={avgScore == null ? "—" : `${avgScore}%`} sub={sessions.length ? `last ${plural(sessions.length, "session")}` : "no practice yet"} />
      </div>

      {/* Jump links: the page is long, so let people go straight to one part. */}
      <nav aria-label="Sections" className="sticky top-14 z-20 -mx-1 mt-4 flex gap-1.5 overflow-x-auto bg-slate-50/90 px-1 py-2 backdrop-blur lg:top-0">
        {[
          ["assignments", "Assignments"],
          ["grades", "Grades"],
          ["materials", "Materials"],
          ["scores", "Score history"],
          ["questions", "Questions"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="chip-off shrink-0">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-3 grid gap-4">
        {/* Assignments */}
        <section id="assignments" className="scroll-mt-28 card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-tu-600" /> Assignments
            </h2>
            <div className="flex gap-1.5">
              {aiEnabled && (
                <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setPasteOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5 text-gold-600" /> Paste (AI)
                </button>
              )}
              <button className="btn-primary px-2.5 py-1.5 text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
          {list.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nothing for {course.course_code} yet. Use <strong>Add</strong>{aiEnabled ? " or Paste (AI)" : ""} — they&apos;re saved to this course
              automatically.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {[...list.filter((a) => a.status === "pending"), ...list.filter((a) => a.status === "completed")].map((a) => (
                <li key={a.id}>
                  <button onClick={() => setOpenId(a.id)} className="group flex w-full items-start gap-2.5 py-2.5 text-left text-sm">
                    {a.status === "completed" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block font-medium group-hover:text-tu-700", a.status === "completed" && "text-slate-400 line-through")}>
                        {shortTitle(a.title, a.course_code)}
                      </span>
                      {a.description && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{a.description}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-slate-500">{formatDue(a.due_date)}</span>
                      <PlatformBadge platform={a.source_platform} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div id="grades" className="scroll-mt-28">
          <GradesPanel course={course} initialComponents={gradeComponents} initialItems={gradeItems} aiEnabled={aiEnabled} />
        </div>

        {/* Materials & exercises (uploaded files, links and notes) */}
        <div id="materials" className="scroll-mt-28">
          <MaterialsPanel courseCode={course.course_code} initialMaterials={initialMaterials} aiEnabled={aiEnabled} />
        </div>
      </div>

      {/* Score history */}
      <section id="scores" className="card mt-4 scroll-mt-28 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="h-5 w-5 text-tu-600" /> Score history
        </h2>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="label">Exams, quizzes &amp; assignments</p>
            {results.length === 0 ? (
              <p className="text-sm text-slate-500">Your real results appear here once you add scores in Grades above.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((r) => {
                  const p = (Number(r.score) / Number(r.max_score)) * 100;
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800">{r.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {componentName.get(r.component_id) ?? ""}
                          {r.taken_on ? ` · ${formatDate(r.taken_on)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-slate-600">
                        {Number(r.score)}/{Number(r.max_score)}
                      </span>
                      <ScorePill pct={p} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <p className="label">Practice quizzes (Quiz Vault)</p>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500">Practice in the Quiz Vault and your scores will show here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sessions.map((sess) => (
                  <li key={sess.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-800">{formatDate(sess.created_at)}</p>
                      {sess.summary && <p className="truncate text-[11px] text-slate-400">{sess.summary}</p>}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-slate-600">
                      {sess.score}/{sess.total_questions}
                    </span>
                    <ScorePill pct={(sess.score / sess.total_questions) * 100} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Saved questions */}
      <section id="questions" className="card mt-4 scroll-mt-28 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <BrainCircuit className="h-5 w-5 text-tu-600" /> Saved quiz questions
          </h2>
          <Link href={`/practice?course=${course.course_code}`} className="text-sm font-medium text-tu-700 hover:underline">
            Open in Quiz Vault →
          </Link>
        </div>
        {questions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No questions saved for this course yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {questions.slice(0, 25).map((q) => (
              <li key={q.id} className="py-2">
                <button onClick={() => setExpanded((x) => (x === q.id ? null : q.id))} className="flex w-full items-start gap-2 text-left">
                  <ChevronDown className={clsx("mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition", expanded !== q.id && "-rotate-90")} />
                  <RichText inline={expanded !== q.id} className={clsx("min-w-0 text-sm text-slate-800", expanded !== q.id && "line-clamp-1")}>{q.question_text}</RichText>
                </button>
                {expanded === q.id && (
                  <div className="ml-6 mt-2 space-y-2 text-sm">
                    {q.options.length > 0 && (
                      <ol className="list-[upper-alpha] space-y-0.5 pl-5 text-slate-700">
                        {q.options.map((o, i) => (
                          <li key={i} className={clsx(o === q.correct_answer && "font-semibold text-emerald-700")}>
                            <RichText inline>{o}</RichText>
                          </li>
                        ))}
                      </ol>
                    )}
                    {q.options.length === 0 && <RichText className="font-medium text-emerald-700">{q.correct_answer}</RichText>}
                    {q.explanation && <RichText className="rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">{q.explanation}</RichText>}
                    <div className="flex flex-wrap gap-1">
                      {q.tags.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AssignmentModal
        assignment={list.find((a) => a.id === openId) ?? null}
        courses={allCourses}
        onClose={() => setOpenId(null)}
        onChanged={(updated) => {
          // Moved to another course → it leaves this list.
          setList((prev) => prev.flatMap((a) => (a.id !== updated.id ? [a] : updated.course_code === course.course_code ? [updated] : [])));
          if (updated.course_code !== course.course_code) setOpenId(null);
          router.refresh();
        }}
        onDeleted={(id) => {
          setList((prev) => prev.filter((a) => a.id !== id));
          router.refresh();
        }}
      />
      <AddAssignmentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        courses={allCourses}
        defaultCourse={course.course_code}
        onCreated={(created) => {
          if (created.course_code === course.course_code) setList((prev) => [created, ...prev]);
          router.refresh();
        }}
      />
      <QuickAddModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        courses={allCourses}
        defaultCourse={course.course_code}
        onCreated={(created) => {
          setList((prev) => [...created.filter((a) => a.course_code === course.course_code), ...prev]);
          router.refresh();
        }}
      />

      <TutorPanel course={course} open={tutorOpen} onClose={() => setTutorOpen(false)} materials={initialMaterials} />
    </div>
  );
}

function Stat({ label, value, sub, children }: { label: string; value: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="card p-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
      {children}
    </div>
  );
}

function ScorePill({ pct }: { pct: number }) {
  return (
    <span
      className={clsx(
        "w-12 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold",
        pct >= 80 ? "bg-emerald-50 text-emerald-700" : pct >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700",
      )}
    >
      {Math.round(pct)}%
    </span>
  );
}
