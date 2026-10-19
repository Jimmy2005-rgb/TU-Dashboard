"use client";

import clsx from "clsx";
import {
  AlarmClock,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Inbox,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CourseBadge, PlatformBadge } from "@/components/ui/badges";
import { api } from "@/components/ui/api";
import { BUCKET_LABELS, formatDue, relativeDue, urgencyBucket, type UrgencyBucket } from "@/lib/dates";
import { PLATFORM_LABELS, type Assignment, type Course, type SourcePlatform } from "@/lib/types";
import QuickAddModal from "./QuickAddModal";

const BUCKET_ORDER: UrgencyBucket[] = ["overdue", "within48h", "thisWeek", "later", "noDate"];
const BUCKET_ACCENT: Record<UrgencyBucket, string> = {
  overdue: "text-red-600",
  within48h: "text-tu-600",
  thisWeek: "text-amber-600",
  later: "text-slate-600",
  noDate: "text-slate-400",
};

type PlatformFilter = "all" | SourcePlatform;

export default function DashboardClient({
  initialAssignments,
  courses,
  serverNow,
}: {
  initialAssignments: Assignment[];
  courses: Course[];
  serverNow: number;
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [now, setNow] = useState(serverNow);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [course, setCourse] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setAssignments(initialAssignments), [initialAssignments]);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const courseCodes = useMemo(() => {
    const codes = new Set(courses.map((c) => c.course_code));
    for (const a of assignments) if (a.course_code) codes.add(a.course_code);
    return [...codes].sort();
  }, [courses, assignments]);

  const filtered = useMemo(
    () =>
      assignments.filter(
        (a) =>
          (platform === "all" || a.source_platform === platform) &&
          (course === "all" || (course === "none" ? !a.course_code : a.course_code === course)),
      ),
    [assignments, platform, course],
  );

  const pending = filtered.filter((a) => a.status === "pending");
  const completed = filtered.filter((a) => a.status === "completed");

  const grouped = useMemo(() => {
    const groups: Record<UrgencyBucket, Assignment[]> = { overdue: [], within48h: [], thisWeek: [], later: [], noDate: [] };
    for (const a of pending) groups[urgencyBucket(a.due_date, now)].push(a);
    for (const list of Object.values(groups)) {
      list.sort((x, y) => (x.due_date ?? "9999").localeCompare(y.due_date ?? "9999"));
    }
    return groups;
  }, [pending, now]);

  async function toggle(a: Assignment) {
    const status = a.status === "pending" ? "completed" : "pending";
    const optimistic = { ...a, status, completed_at: status === "completed" ? new Date().toISOString() : null } as Assignment;
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? optimistic : x)));
    try {
      const { assignment } = await api<{ assignment: Assignment }>(`/api/assignments/${a.id}`, {
        method: "PATCH",
        body: { status },
      });
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? assignment : x)));
    } catch (err) {
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
      setError((err as Error).message);
    }
  }

  async function remove(a: Assignment) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    const before = assignments;
    setAssignments((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await api(`/api/assignments/${a.id}`, { method: "DELETE" });
    } catch (err) {
      setAssignments(before);
      setError((err as Error).message);
    }
  }

  const stats = [
    { label: "Overdue", value: grouped.overdue.length, icon: AlarmClock, tone: "text-red-600 bg-red-50" },
    { label: "Due < 48h", value: grouped.within48h.length, icon: CalendarClock, tone: "text-tu-600 bg-tu-50" },
    { label: "This week", value: grouped.thisWeek.length, icon: CalendarDays, tone: "text-amber-600 bg-amber-50" },
    { label: "Done (3 wks)", value: completed.length, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "full" }).format(now)}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setQuickAddOpen(true)}>
          <Sparkles className="h-4 w-4" /> Quick Add / Paste Syllabus
        </button>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card flex items-center gap-3 p-3.5">
            <div className={clsx("rounded-lg p-2", tone)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mt-4 flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">Platform</span>
          {(["all", "ms_teams", "google_classroom", "manual"] as PlatformFilter[]).map((p) => (
            <button key={p} onClick={() => setPlatform(p)} className={platform === p ? "chip-on" : "chip-off"}>
              {p === "all" ? "All" : PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">Course</span>
          <button onClick={() => setCourse("all")} className={course === "all" ? "chip-on" : "chip-off"}>
            All
          </button>
          {courseCodes.map((c) => (
            <button key={c} onClick={() => setCourse(c)} className={clsx(course === c ? "chip-on" : "chip-off", "font-mono")}>
              {c}
            </button>
          ))}
          <button onClick={() => setCourse("none")} className={course === "none" ? "chip-on" : "chip-off"}>
            General
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Groups */}
      <div className="mt-5 space-y-5">
        {pending.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700">Nothing pending</p>
            <p className="max-w-sm text-sm text-slate-500">
              Paste a syllabus or LMS notification with Quick Add, or connect Make.com / n8n to the webhook to sync Teams
              and Google Classroom automatically.
            </p>
          </div>
        )}

        {BUCKET_ORDER.map((bucket) =>
          grouped[bucket].length ? (
            <section key={bucket}>
              <h2 className={clsx("mb-2 flex items-center gap-2 text-sm font-semibold", BUCKET_ACCENT[bucket])}>
                {BUCKET_LABELS[bucket]}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {grouped[bucket].length}
                </span>
              </h2>
              <ul className="card divide-y divide-slate-100">
                {grouped[bucket].map((a) => (
                  <AssignmentRow key={a.id} a={a} now={now} onToggle={toggle} onDelete={remove} />
                ))}
              </ul>
            </section>
          ) : null,
        )}

        {completed.length > 0 && (
          <section>
            <button
              onClick={() => setShowCompleted((s) => !s)}
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"
            >
              <ChevronDown className={clsx("h-4 w-4 transition", !showCompleted && "-rotate-90")} />
              Completed
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{completed.length}</span>
            </button>
            {showCompleted && (
              <ul className="card divide-y divide-slate-100">
                {completed.map((a) => (
                  <AssignmentRow key={a.id} a={a} now={now} onToggle={toggle} onDelete={remove} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        courses={courseCodes}
        onCreated={(created) => setAssignments((prev) => [...created, ...prev])}
      />
    </div>
  );
}

function AssignmentRow({
  a,
  now,
  onToggle,
  onDelete,
}: {
  a: Assignment;
  now: number;
  onToggle: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
}) {
  const done = a.status === "completed";
  const bucket = urgencyBucket(a.due_date, now);
  return (
    <li className="group flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50/70">
      <button
        onClick={() => onToggle(a)}
        className={clsx("mt-0.5 shrink-0 rounded-full transition", done ? "text-emerald-500" : "text-slate-300 hover:text-tu-500")}
        aria-label={done ? "Mark as pending" : "Mark as completed"}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <CourseBadge code={a.course_code} />
          <PlatformBadge platform={a.source_platform} />
          <p className={clsx("min-w-0 truncate text-sm font-medium", done ? "text-slate-400 line-through" : "text-slate-900")}>
            {a.title}
          </p>
        </div>
        {a.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{a.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="text-right">
          <p className={clsx("text-xs font-medium", done ? "text-slate-400" : BUCKET_ACCENT[bucket])}>{formatDue(a.due_date)}</p>
          {!done && a.due_date && <p className="text-[11px] text-slate-400">{relativeDue(a.due_date, now)}</p>}
        </div>
        {a.external_link && (
          <a
            href={a.external_link}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Open in LMS"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          onClick={() => onDelete(a)}
          className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
