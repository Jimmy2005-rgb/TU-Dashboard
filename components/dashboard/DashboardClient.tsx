"use client";

import clsx from "clsx";
import { Check, CheckCircle2, ChevronDown, Circle, ExternalLink, Inbox, PartyPopper, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AssignmentModal from "@/components/AssignmentModal";
import { useCourseColorClass, useCourseColors } from "@/components/CourseColors";
import { CourseBadge, PlatformBadge } from "@/components/ui/badges";
import { api } from "@/components/ui/api";
import {
  BUCKET_LABELS,
  bangkokWeekRange,
  formatDue,
  formatLongDate,
  greeting,
  relativeDue,
  urgencyBucket,
  type UrgencyBucket,
} from "@/lib/dates";
import { PLATFORM_LABELS, type Assignment, type Course, type SourcePlatform } from "@/lib/types";
import { shortTitle } from "@/lib/text";
import AddAssignmentModal from "./AddAssignmentModal";
import QuickAddModal from "./QuickAddModal";

const BUCKET_ORDER: UrgencyBucket[] = ["overdue", "within48h", "thisWeek", "later", "noDate"];
const BUCKET_ACCENT: Record<UrgencyBucket, string> = {
  overdue: "text-red-600",
  within48h: "text-tu-600",
  thisWeek: "text-amber-700",
  later: "text-slate-500",
  noDate: "text-slate-400",
};
// How long a ticked task stays visible (checked) before it moves to Completed.
const SETTLE_MS = 650;

type PlatformFilter = "all" | SourcePlatform;

/** Most urgent first: overdue (oldest first), then soonest due, then undated (oldest added first). */
function byUrgency(a: Assignment, b: Assignment) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

export default function DashboardClient({
  initialAssignments,
  courses,
  serverNow,
  aiEnabled,
}: {
  initialAssignments: Assignment[];
  courses: Course[];
  serverNow: number;
  aiEnabled: boolean;
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [now, setNow] = useState(serverNow);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [course, setCourse] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [settling, setSettling] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const colors = useCourseColors();

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
    for (const list of Object.values(groups)) list.sort(byUrgency);
    return groups;
  }, [pending, now]);

  // "Next up" ignores filters: it's always your single most urgent task.
  const nextUp = useMemo(
    () => assignments.filter((a) => a.status === "pending" && !settling.has(a.id)).sort(byUrgency)[0] ?? null,
    [assignments, settling],
  );

  // Weekly progress: tasks due this Monday–Sunday (Bangkok) that are done.
  const week = useMemo(() => {
    const [start, end] = bangkokWeekRange(now);
    const inWeek = assignments.filter((a) => {
      const t = a.due_date ? new Date(a.due_date).getTime() : NaN;
      return t >= start && t < end;
    });
    return { total: inWeek.length, done: inWeek.filter((a) => a.status === "completed" || settling.has(a.id)).length };
  }, [assignments, now, settling]);

  function showToast(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  async function complete(a: Assignment) {
    // Show the tick first, then let the task settle into "Completed".
    setSettling((s) => new Set(s).add(a.id));
    const doneAt = new Date().toISOString();
    const request = api<{ assignment: Assignment }>(`/api/assignments/${a.id}`, { method: "PATCH", body: { status: "completed" } });
    setTimeout(() => {
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: "completed", completed_at: doneAt } : x)));
      setSettling((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }, SETTLE_MS);
    try {
      const { assignment } = await request;
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? assignment : x)));
      const [start, end] = bangkokWeekRange(Date.now());
      const due = a.due_date ? new Date(a.due_date).getTime() : NaN;
      const doneThisWeek =
        assignments.filter((x) => {
          const t = x.due_date ? new Date(x.due_date).getTime() : NaN;
          return t >= start && t < end && x.status === "completed";
        }).length + (due >= start && due < end ? 1 : 0);
      showToast(doneThisWeek > 0 ? `Nice — ${doneThisWeek} done this week ✓` : "Nice — one less thing ✓");
    } catch (err) {
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
      setError((err as Error).message);
    }
  }

  async function reopen(a: Assignment) {
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: "pending", completed_at: null } : x)));
    try {
      const { assignment } = await api<{ assignment: Assignment }>(`/api/assignments/${a.id}`, { method: "PATCH", body: { status: "pending" } });
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

  const toggle = (a: Assignment) => (a.status === "completed" ? reopen(a) : complete(a));
  const stats = [
    { label: "Overdue", value: grouped.overdue.length, tone: "text-red-600" },
    { label: "Due in 48h", value: grouped.within48h.length, tone: "text-tu-600" },
    { label: "Rest of week", value: grouped.thisWeek.length, tone: "text-amber-700" },
    { label: "Later", value: grouped.later.length + grouped.noDate.length, tone: "text-slate-500" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{formatLongDate(now)}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{greeting(now)} 👋</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            onClick={() => setQuickAddOpen(true)}
            disabled={!aiEnabled}
            title={aiEnabled ? "Paste or drop a syllabus — AI finds the deadlines" : "AI is off: add a free GEMINI_API_KEY in Vercel to turn it on"}
          >
            <Sparkles className="h-4 w-4 text-gold-600" /> Paste Syllabus
          </button>
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add assignment
          </button>
        </div>
      </div>

      {/* Next up */}
      <NextUpCard task={nextUp} now={now} week={week} onDone={complete} onOpen={(id) => setOpenId(id)} />

      {/* At a glance */}
      <div data-calm="hide" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, tone }) => (
          <div key={label} className="card px-4 py-3">
            <p className={clsx("text-2xl font-bold tabular-nums leading-none", value ? tone : "text-slate-300")}>{value}</p>
            <p className="mt-1.5 text-xs font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setCourse("all")} className={course === "all" ? "chip-on" : "chip-off"}>
            All courses
          </button>
          {courseCodes.map((c) => (
            <button
              key={c}
              onClick={() => setCourse(course === c ? "all" : c)}
              className={clsx(course === c ? "chip-on" : "chip-off", "font-mono", colors[c] && `course-${colors[c]}`)}
            >
              <span className="course-dot" />
              {c}
            </button>
          ))}
          <button onClick={() => setCourse("none")} className={course === "none" ? "chip-on" : "chip-off"}>
            General
          </button>
        </div>
        <div data-calm="hide" className="flex flex-wrap items-center gap-1.5">
          {(["all", "ms_teams", "google_classroom", "manual"] as PlatformFilter[]).map((p) => (
            <button key={p} onClick={() => setPlatform(p)} className={platform === p ? "chip-on" : "chip-off"}>
              {p === "all" ? "All sources" : PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Lists */}
      <div className="mt-4 space-y-6">
        {pending.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700">{course === "all" && platform === "all" ? "Nothing pending" : "Nothing pending here"}</p>
            <p className="max-w-sm text-sm text-slate-500">
              Click <strong>Add assignment</strong> to type in a deadline{aiEnabled ? ", or paste a syllabus with AI" : ""}.
            </p>
          </div>
        )}

        {BUCKET_ORDER.map((bucket) =>
          grouped[bucket].length ? (
            <section key={bucket}>
              <h2 className={clsx("mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider", BUCKET_ACCENT[bucket])}>
                {BUCKET_LABELS[bucket]}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-slate-500">
                  {grouped[bucket].length}
                </span>
              </h2>
              <ul className="card divide-y divide-slate-100 overflow-hidden">
                {grouped[bucket].map((a) => (
                  <AssignmentRow
                    key={a.id}
                    a={a}
                    now={now}
                    settling={settling.has(a.id)}
                    onToggle={toggle}
                    onDelete={remove}
                    onOpen={() => setOpenId(a.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null,
        )}

        {completed.length > 0 && (
          <section>
            <button
              onClick={() => setShowCompleted((s) => !s)}
              className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-emerald-700"
            >
              <ChevronDown className={clsx("h-4 w-4 transition", !showCompleted && "-rotate-90")} />
              Completed
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-slate-500">
                {completed.length}
              </span>
            </button>
            {showCompleted && (
              <ul className="card divide-y divide-slate-100 overflow-hidden">
                {completed.map((a) => (
                  <AssignmentRow key={a.id} a={a} now={now} settling={false} onToggle={toggle} onDelete={remove} onOpen={() => setOpenId(a.id)} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex animate-fade-up items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-lift">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {toast}
          </div>
        </div>
      )}

      <AssignmentModal
        assignment={assignments.find((x) => x.id === openId) ?? null}
        courses={courseCodes}
        onClose={() => setOpenId(null)}
        onChanged={(updated) => setAssignments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
        onDeleted={(id) => setAssignments((prev) => prev.filter((x) => x.id !== id))}
      />
      <AddAssignmentModal open={addOpen} onClose={() => setAddOpen(false)} courses={courseCodes} onCreated={(created) => setAssignments((prev) => [created, ...prev])} />
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} courses={courseCodes} onCreated={(created) => setAssignments((prev) => [...created, ...prev])} />
    </div>
  );
}

/** The single most urgent task, big and calm, with the week's progress beside it. */
function NextUpCard({
  task,
  now,
  week,
  onDone,
  onOpen,
}: {
  task: Assignment | null;
  now: number;
  week: { total: number; done: number };
  onDone: (a: Assignment) => void;
  onOpen: (id: string) => void;
}) {
  const colorClass = useCourseColorClass(task?.course_code);
  const bucket = task ? urgencyBucket(task.due_date, now) : "noDate";
  return (
    <section className={clsx("card course-bar mt-6 overflow-hidden", colorClass)}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Target className="h-3.5 w-3.5" /> Next up
          </p>
          {task ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <CourseBadge code={task.course_code} />
                <PlatformBadge platform={task.source_platform} />
              </div>
              <button onClick={() => onOpen(task.id)} className="mt-1.5 block text-left">
                <h2 className="text-xl font-semibold leading-snug tracking-tight text-slate-900 hover:text-tu-700 sm:text-2xl">{shortTitle(task.title, task.course_code)}</h2>
              </button>
              <p className={clsx("mt-1.5 text-sm font-medium", BUCKET_ACCENT[bucket])}>
                {task.due_date ? (
                  <>
                    {bucket === "overdue" ? "Overdue" : "Due"} {relativeDue(task.due_date, now)} · <span className="text-slate-500">{formatDue(task.due_date)}</span>
                  </>
                ) : (
                  <span className="text-slate-500">No due date</span>
                )}
              </p>
              {task.description && (
                <p data-calm="hide" className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                  {task.description}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => onDone(task)}>
                  <Check className="h-4 w-4" /> Mark done
                </button>
                <button className="btn-secondary" onClick={() => onOpen(task.id)}>
                  Details
                </button>
              </div>
            </>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <PartyPopper className="h-8 w-8 text-gold-500" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900">All clear</h2>
                <p className="text-sm text-slate-500">Nothing pending. Enjoy the break — or add what&apos;s coming next.</p>
              </div>
            </div>
          )}
        </div>
        <WeekRing done={week.done} total={week.total} />
      </div>
    </section>
  );
}

/** Progress ring for tasks due this week. */
function WeekRing({ done, total }: { done: number; total: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const label = total ? `${done} of ${total} tasks due this week are done` : "No deadlines this week";
  return (
    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:gap-1.5" title={label} aria-label={label} role="img">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" className="stroke-slate-100" />
        {total > 0 && (
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className={clsx("transition-[stroke-dashoffset] duration-700 ease-out", pct >= 1 ? "stroke-emerald-500" : "stroke-tu-500")}
          />
        )}
        <text
          x="38"
          y="38"
          dominantBaseline="central"
          textAnchor="middle"
          className="rotate-90 fill-slate-900 text-[15px] font-bold tabular-nums"
          style={{ transformOrigin: "38px 38px" }}
        >
          {total ? `${done}/${total}` : "—"}
        </text>
      </svg>
      <p className="text-xs font-medium text-slate-500">{total ? (done >= total ? "Week done! 🎉" : "This week") : "No deadlines this week"}</p>
    </div>
  );
}

function AssignmentRow({
  a,
  now,
  settling,
  onToggle,
  onDelete,
  onOpen,
}: {
  a: Assignment;
  now: number;
  settling: boolean;
  onToggle: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
  onOpen: () => void;
}) {
  const colorClass = useCourseColorClass(a.course_code);
  const done = a.status === "completed" || settling;
  const bucket = urgencyBucket(a.due_date, now);
  return (
    <li className={clsx("course-bar group flex items-start gap-3 py-3 pl-4 pr-3 transition-colors hover:bg-slate-50", colorClass, settling && "bg-emerald-50")}>
      <button
        onClick={() => !settling && onToggle(a)}
        className={clsx(
          "mt-0.5 shrink-0 rounded-full transition",
          done ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500",
          settling && "animate-pop",
        )}
        aria-label={done ? "Mark as not done" : "Mark as done"}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left" title="Show full details">
        <div className="flex flex-wrap items-center gap-1.5">
          <CourseBadge code={a.course_code} />
          <PlatformBadge platform={a.source_platform} />
        </div>
        <p
          className={clsx(
            "mt-1 text-sm font-medium leading-snug transition-colors group-hover:text-tu-700",
            done ? "text-slate-400 line-through" : "text-slate-900",
          )}
        >
          {shortTitle(a.title, a.course_code)}
        </p>
        {a.description && (
          <p data-calm="hide" className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-slate-500">
            {a.description}
          </p>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <div className="text-right">
          <p className={clsx("text-xs font-medium tabular-nums", done ? "text-slate-400" : BUCKET_ACCENT[bucket])}>{formatDue(a.due_date)}</p>
          {!done && a.due_date && <p className="text-[11px] text-slate-400">{relativeDue(a.due_date, now)}</p>}
        </div>
        {a.external_link && (
          <a
            href={a.external_link}
            target="_blank"
            rel="noopener noreferrer"
            data-calm="hide"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Open in Teams / Classroom"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          onClick={() => onDelete(a)}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
