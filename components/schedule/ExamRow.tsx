"use client";

import clsx from "clsx";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { CourseBadge } from "@/components/ui/badges";
import { useCourseColorClass } from "@/components/CourseColors";
import { formatDue, toBangkokInputs } from "@/lib/dates";
import { fmtPct } from "@/lib/grades";
import type { GradeNeed } from "@/lib/grade-needs";
import { daysUntil } from "@/lib/schedule";
import { EXAM_KIND_LABELS, type Exam } from "@/lib/types";

export function countdownLabel(days: number): string {
  if (days < 0) return days === -1 ? "Yesterday" : `${-days} days ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

/** "Need 84% average on the remaining 45% for an A" — or that it's safe / out of reach. */
export function needText(need: GradeNeed | undefined): { text: string; tone: "ok" | "warn" | "info" } | null {
  if (!need || need.needed == null || need.remainingWeight <= 0) return null;
  const grade = `${need.targetLetter} (${fmtPct(need.target, 0)})`;
  if (need.needed <= 0) return { text: `${grade} is already safe ✓`, tone: "ok" };
  if (need.needed > 100) return { text: `${grade} is out of reach now — lower your target on the course page`, tone: "warn" };
  return { text: `Need ${fmtPct(need.needed, 0)} average on the remaining ${fmtPct(need.remainingWeight, 0)} for ${grade}`, tone: "info" };
}

export default function ExamRow({
  exam,
  need,
  now,
  compact = false,
  onEdit,
  onDelete,
}: {
  exam: Exam;
  need?: GradeNeed;
  now: number;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const colorClass = useCourseColorClass(exam.course_code);
  const days = daysUntil(exam.starts_at, now);
  const showNeed = exam.kind === "midterm" || exam.kind === "final" || exam.component_id;
  const n = showNeed ? needText(need) : null;
  const endTime = exam.ends_at ? `–${toBangkokInputs(exam.ends_at).time}` : "";

  return (
    <div className={clsx("course-bar flex items-center gap-3 rounded-xl border border-slate-200 bg-surface py-3 pl-4 pr-3", colorClass)}>
      <div
        className={clsx(
          "flex w-16 shrink-0 flex-col items-center rounded-lg py-1.5 text-center",
          days < 0 ? "bg-slate-100 text-slate-400" : days <= 3 ? "bg-red-50 text-red-700" : days <= 14 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700",
        )}
      >
        {days > 1 ? (
          <>
            <span className="text-xl font-bold leading-none tabular-nums">{days}</span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide">days</span>
          </>
        ) : (
          <span className="text-xs font-semibold leading-tight">{countdownLabel(days)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <CourseBadge code={exam.course_code} />
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{EXAM_KIND_LABELS[exam.kind]}</span>
        </div>
        <p className="mt-0.5 truncate font-medium text-slate-900">{exam.title}</p>
        <p className="text-xs text-slate-500">
          {formatDue(exam.starts_at)}
          {endTime}
          {exam.room && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {exam.room}
            </span>
          )}
        </p>
        {n && !compact && (
          <p className={clsx("mt-1 text-xs font-medium", n.tone === "ok" ? "text-emerald-700" : n.tone === "warn" ? "text-amber-700" : "text-slate-700")}>
            {n.text}
          </p>
        )}
        {n && compact && <p className="mt-0.5 truncate text-xs text-slate-500" data-calm="hide">{n.text}</p>}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 gap-0.5">
          {onEdit && (
            <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit exam">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete exam">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
