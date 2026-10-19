const TZ = "Asia/Bangkok";

export type UrgencyBucket = "overdue" | "within48h" | "thisWeek" | "later" | "noDate";

export const BUCKET_LABELS: Record<UrgencyBucket, string> = {
  overdue: "Overdue",
  within48h: "< 48 Hours",
  thisWeek: "This Week",
  later: "Later",
  noDate: "No Due Date",
};

const HOUR = 60 * 60 * 1000;

export function urgencyBucket(dueDate: string | null, now = Date.now()): UrgencyBucket {
  if (!dueDate) return "noDate";
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return "noDate";
  const diff = due - now;
  if (diff < 0) return "overdue";
  if (diff <= 48 * HOUR) return "within48h";
  if (diff <= 7 * 24 * HOUR) return "thisWeek";
  return "later";
}

export function formatDue(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "No due date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

/** "in 5h", "in 3d", "2d ago" */
export function relativeDue(dueDate: string | null, now = Date.now()): string {
  if (!dueDate) return "";
  const diff = new Date(dueDate).getTime() - now;
  if (Number.isNaN(diff)) return "";
  const abs = Math.abs(diff);
  const label = abs < HOUR ? `${Math.max(1, Math.round(abs / 60000))}m` : abs < 48 * HOUR ? `${Math.round(abs / HOUR)}h` : `${Math.round(abs / (24 * HOUR))}d`;
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

/**
 * Parse a loosely formatted date from an automation payload. Strings without
 * an explicit offset are interpreted as Bangkok time.
 */
export function parseIncomingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const isoLocal = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(trimmed);
  let candidate = trimmed;
  if (isoLocal && !hasZone) {
    candidate = trimmed.length === 10 ? `${trimmed}T23:59:00+07:00` : `${trimmed}+07:00`;
  }
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
