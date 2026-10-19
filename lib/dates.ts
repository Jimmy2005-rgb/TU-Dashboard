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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Date pieces in Bangkok time (UTC+7, no daylight saving). We build display
 * strings ourselves because Node and browsers word Intl output differently
 * ("Wed, 21 Oct" vs "Wed 21 Oct", "Sep" vs "Sept"), which would make server-
 * and client-rendered text disagree.
 */
function bangkok(d: Date) {
  const t = new Date(d.getTime() + 7 * 3600 * 1000);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
    time: `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`,
  };
}

/** "Wed 21 Oct, 23:59" */
export function formatDue(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "No due date";
  const b = bangkok(d);
  return `${DAYS[b.weekday].slice(0, 3)} ${b.day} ${MONTHS[b.month].slice(0, 3)}, ${b.time}`;
}

/** "21 Oct 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const b = bangkok(d);
  return `${b.day} ${MONTHS[b.month].slice(0, 3)} ${b.year}`;
}

/** "Wednesday, 21 October 2026" */
export function formatLongDate(d: Date | number): string {
  const b = bangkok(new Date(d));
  return `${DAYS[b.weekday]}, ${b.day} ${MONTHS[b.month]} ${b.year}`;
}

/** Monday 00:00 → next Monday 00:00 (Bangkok) for the week containing `now`, as epoch ms. */
export function bangkokWeekRange(now: number): [number, number] {
  const OFFSET = 7 * 3600 * 1000;
  const local = new Date(now + OFFSET); // shifted so UTC getters read Bangkok wall time
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - OFFSET;
  return [start, start + 7 * 24 * 3600 * 1000];
}

/** "Good morning" / "Good afternoon" / "Good evening" for Bangkok time. */
export function greeting(now: number): string {
  const hour = new Date(now + 7 * 3600 * 1000).getUTCHours();
  return hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** Values for <input type="date"> and <input type="time"> in Bangkok time. */
export function toBangkokInputs(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "23:59" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "23:59" };
  const b = bangkok(d);
  return { date: `${b.year}-${String(b.month + 1).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`, time: b.time };
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
