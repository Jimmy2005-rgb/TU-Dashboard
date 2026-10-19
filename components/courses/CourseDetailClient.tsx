"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PlatformBadge, Tag } from "@/components/ui/badges";
import { api } from "@/components/ui/api";
import { formatDate, formatDue } from "@/lib/dates";
import type { Assignment, Course, CourseMaterial, PracticeSession, QuizQuestion } from "@/lib/types";
import AddCourseButton from "./AddCourseButton";
import TutorPanel from "./TutorPanel";

export default function CourseDetailClient({
  course,
  assignments,
  initialMaterials,
  questions,
  sessions,
}: {
  course: Course;
  assignments: Assignment[];
  initialMaterials: CourseMaterial[];
  questions: QuizQuestion[];
  sessions: PracticeSession[];
}) {
  const [tutorOpen, setTutorOpen] = useState(false);
  const [materials, setMaterials] = useState(initialMaterials);
  const [form, setForm] = useState({ title: "", url: "", notes: "" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const done = assignments.filter((a) => a.status === "completed").length;
  const pct = assignments.length ? Math.round((done / assignments.length) * 100) : 0;
  const upcoming = assignments.filter((a) => a.status === "pending");
  const avgScore = sessions.length
    ? Math.round((sessions.reduce((s, x) => s + x.score / x.total_questions, 0) / sessions.length) * 100)
    : null;

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const { material } = await api<{ material: CourseMaterial }>(`/api/courses/${course.course_code}/materials`, {
        body: { title: form.title, url: form.url || null, notes: form.notes || null },
      });
      setMaterials((prev) => [material, ...prev]);
      setForm({ title: "", url: "", notes: "" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeMaterial(m: CourseMaterial) {
    if (!confirm(`Remove "${m.title}"?`)) return;
    const before = materials;
    setMaterials((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await api(`/api/materials/${m.id}`, { method: "DELETE" });
    } catch (err) {
      setMaterials(before);
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-tu-600">{course.course_code}</p>
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
          <button className="btn-primary" onClick={() => setTutorOpen(true)}>
            <Bot className="h-4 w-4" /> Ask Tutor
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Course progress" value={`${pct}%`} sub={`${done}/${assignments.length} assignments`}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-tu-600" style={{ width: `${pct}%` }} />
          </div>
        </Stat>
        <Stat label="Pending" value={String(upcoming.length)} sub="tasks left" />
        <Stat label="Saved questions" value={String(questions.length)} sub="in the vault" />
        <Stat label="Practice avg" value={avgScore == null ? "—" : `${avgScore}%`} sub={`last ${sessions.length} sessions`} />
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Assignments */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-tu-600" /> Assignments
          </h2>
          {assignments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nothing yet. Add deadlines from the dashboard.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {[...upcoming, ...assignments.filter((a) => a.status === "completed")].slice(0, 12).map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 py-2 text-sm">
                  {a.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                  <span className={clsx("min-w-0 flex-1 truncate", a.status === "completed" && "text-slate-400 line-through")}>{a.title}</span>
                  <PlatformBadge platform={a.source_platform} />
                  <span className="shrink-0 text-xs text-slate-500">{formatDue(a.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Materials */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-tu-600" /> Materials
          </h2>
          <form onSubmit={addMaterial} className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Title (e.g. Week 3 slides — Bond valuation)"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <button type="submit" className="btn-primary shrink-0 px-3" disabled={adding || !form.title.trim()} aria-label="Add material">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
            {form.title && (
              <>
                <input
                  className="input"
                  placeholder="Link (Google Drive, OneDrive, Teams file…) — optional"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                />
                <textarea
                  className="input min-h-[60px]"
                  placeholder="Notes — optional"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </>
            )}
          </form>
          {materials.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Save slide decks, readings and notes for quick access.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {materials.map((m) => (
                <li key={m.id} className="group flex items-start gap-2 py-2 text-sm">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    {m.url ? (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-tu-700">
                        {m.title} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="font-medium text-slate-800">{m.title}</p>
                    )}
                    {m.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{m.notes}</p>}
                  </div>
                  <button
                    onClick={() => removeMaterial(m)}
                    className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Remove material"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Saved questions */}
      <section className="card mt-4 p-5">
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
                  <span className={clsx("text-sm text-slate-800", expanded !== q.id && "line-clamp-1")}>{q.question_text}</span>
                </button>
                {expanded === q.id && (
                  <div className="ml-6 mt-2 space-y-2 text-sm">
                    {q.options.length > 0 && (
                      <ol className="list-[upper-alpha] space-y-0.5 pl-5 text-slate-700">
                        {q.options.map((o, i) => (
                          <li key={i} className={clsx(o === q.correct_answer && "font-semibold text-emerald-700")}>
                            {o}
                          </li>
                        ))}
                      </ol>
                    )}
                    {q.options.length === 0 && <p className="font-medium text-emerald-700">{q.correct_answer}</p>}
                    {q.explanation && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">{q.explanation}</p>}
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
        {sessions.length > 0 && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Last practice: {formatDate(sessions[0].created_at)} — {sessions[0].summary}
          </p>
        )}
      </section>

      <TutorPanel course={course} open={tutorOpen} onClose={() => setTutorOpen(false)} />
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
