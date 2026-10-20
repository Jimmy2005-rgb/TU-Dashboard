import type { ClassSlot, StudySettings } from "./types";

/**
 * Timetable maths, all in Bangkok time (UTC+7, no daylight saving).
 * Dates are "YYYY-MM-DD" keys; we step through days with UTC arithmetic so the
 * result is the same on the server and in the browser.
 */

const DAY_MS = 24 * 3600 * 1000;
const BKK_MS = 7 * 3600 * 1000;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ClassOccurrence {
  /** Class number counted from the semester start, or null when no start date is set. */
  n: number | null;
  course_code: string;
  date: string; // YYYY-MM-DD
  weekday: number; // 1 = Monday
  start: string; // ISO with +07:00
  end: string;
  room: string | null;
  slot: ClassSlot;
}

/** "09:30:00" → "09:30" */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

/** Bangkok calendar date for an instant. */
export function bangkokDateKey(ms: number): string {
  return new Date(ms + BKK_MS).toISOString().slice(0, 10);
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

/** 1 = Monday … 7 = Sunday */
export function weekdayOf(key: string): number {
  return ((new Date(keyToUtc(key)).getUTCDay() + 6) % 7) + 1;
}

/** "2026-10-21" + "09:30" → "2026-10-21T09:30:00+07:00" */
export function bangkokIso(key: string, time: string): string {
  return `${key}T${hhmm(time)}:00+07:00`;
}

/** "Wed 21 Oct" */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(key) - 1].slice(0, 3)} ${d} ${MONTHS[m - 1]}`;
}

export function isNoClassDay(key: string, settings: StudySettings | null): string | null {
  for (const p of settings?.no_class_days ?? []) {
    if (key >= p.start && key <= (p.end || p.start)) return p.label || "No class";
  }
  return null;
}

function sortSlots(slots: ClassSlot[]): ClassSlot[] {
  return [...slots].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}

/**
 * Every class meeting between two dates (inclusive), in time order.
 * Classes are numbered per course from the semester start, skipping no-class days,
 * so "Class 11" can be turned into a real date.
 */
export function classOccurrences(
  slots: ClassSlot[],
  settings: StudySettings | null,
  from: string,
  to: string,
): ClassOccurrence[] {
  const start = settings?.semester_start ?? null;
  const end = settings?.semester_end ?? null;
  const byDay = new Map<number, ClassSlot[]>();
  for (const s of sortSlots(slots)) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s]);

  const counters = new Map<string, number>();
  const out: ClassOccurrence[] = [];
  // Count from the semester start so numbers stay right even when `from` is later.
  let day = start && start < from ? start : from;
  const last = end && end < to ? end : to;
  for (let guard = 0; day <= last && guard < 400; guard++, day = addDays(day, 1)) {
    if (start && day < start) continue;
    if (isNoClassDay(day, settings)) continue;
    for (const slot of byDay.get(weekdayOf(day)) ?? []) {
      const n = start ? (counters.get(slot.course_code) ?? 0) + 1 : null;
      if (n) counters.set(slot.course_code, n);
      if (day < from) continue;
      out.push({
        n,
        course_code: slot.course_code,
        date: day,
        weekday: slot.weekday,
        start: bangkokIso(day, slot.start_time),
        end: bangkokIso(day, slot.end_time),
        room: slot.room,
        slot,
      });
    }
  }
  return out;
}

/** Classes from today (Bangkok) for the next `days` days. */
export function upcomingClasses(slots: ClassSlot[], settings: StudySettings | null, now: number, days = 14): ClassOccurrence[] {
  const today = bangkokDateKey(now);
  return classOccurrences(slots, settings, today, addDays(today, days));
}

/** All numbered classes of one course this semester (needs a semester start). */
export function courseClasses(slots: ClassSlot[], settings: StudySettings | null, courseCode: string): ClassOccurrence[] {
  if (!settings?.semester_start) return [];
  const own = slots.filter((s) => s.course_code === courseCode);
  const end = settings.semester_end ?? addDays(settings.semester_start, 140);
  return classOccurrences(own, settings, settings.semester_start, end);
}

/**
 * Plain-text class calendar for the AI, so "before Class 11" or "in next week's
 * class" resolves to a real date and time.
 */
export function classCalendarForAi(slots: ClassSlot[], settings: StudySettings | null, now: number): string {
  if (!slots.length) return "";
  const lines: string[] = [];
  const weekly = sortSlots(slots).map(
    (s) => `${s.course_code}: ${WEEKDAYS[s.weekday - 1]} ${hhmm(s.start_time)}–${hhmm(s.end_time)}${s.room ? ` (${s.room})` : ""}`,
  );
  lines.push("Weekly timetable (Bangkok time):", ...weekly);
  if (settings?.semester_start) {
    const today = bangkokDateKey(now);
    const codes = [...new Set(slots.map((s) => s.course_code))].sort();
    lines.push("", "Numbered class meetings (use these for 'Class N', 'next class', 'before class'):");
    for (const code of codes) {
      const list = courseClasses(slots, settings, code).filter((c) => c.date >= addDays(today, -21)).slice(0, 18);
      if (list.length) lines.push(`${code}: ${list.map((c) => `Class ${c.n} = ${c.date} ${hhmm(c.slot.start_time)}`).join("; ")}`);
    }
  }
  return lines.join("\n");
}

/** Whole days from today until a date (0 = today), Bangkok calendar. */
export function daysUntil(iso: string, now: number): number {
  return Math.round((keyToUtc(bangkokDateKey(new Date(iso).getTime())) - keyToUtc(bangkokDateKey(now))) / DAY_MS);
}
