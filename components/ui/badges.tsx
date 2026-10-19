"use client";

import clsx from "clsx";
import { useCourseColorClass } from "@/components/CourseColors";
import { PLATFORM_LABELS, type SourcePlatform } from "@/lib/types";

const PLATFORM_STYLES: Record<SourcePlatform, string> = {
  ms_teams: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  google_classroom: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  manual: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function PlatformBadge({ platform }: { platform: SourcePlatform }) {
  return (
    <span
      data-calm="hide"
      className={clsx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", PLATFORM_STYLES[platform])}
    >
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

/** Course identity: colour dot + code (the code is always shown, so colour is never the only cue). */
export function CourseBadge({ code }: { code: string | null }) {
  const colorClass = useCourseColorClass(code);
  if (!code) return <span className="text-[11px] font-medium text-slate-400">General</span>;
  return (
    <span className={clsx("course-chip", colorClass)}>
      <span className="course-dot" />
      {code}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{children}</span>;
}
