import clsx from "clsx";
import { PLATFORM_LABELS, type SourcePlatform } from "@/lib/types";

const PLATFORM_STYLES: Record<SourcePlatform, string> = {
  ms_teams: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  google_classroom: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  manual: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function PlatformBadge({ platform }: { platform: SourcePlatform }) {
  return (
    <span className={clsx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", PLATFORM_STYLES[platform])}>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export function CourseBadge({ code }: { code: string | null }) {
  if (!code) return <span className="text-[11px] font-medium text-slate-400">General</span>;
  return (
    <span className="inline-flex items-center rounded-md bg-tu-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-tu-700 ring-1 ring-inset ring-tu-200">
      {code}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{children}</span>;
}
