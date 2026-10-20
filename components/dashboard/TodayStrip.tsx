"use client";

import clsx from "clsx";
import { ArrowRight, CalendarClock, GraduationCap, MapPin, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCourseColors } from "@/components/CourseColors";
import { useSchedule } from "@/components/ScheduleContext";
import ExamRow from "@/components/schedule/ExamRow";
import type { GradeNeed } from "@/lib/grade-needs";
import { bangkokDateKey, hhmm, shortDate, upcomingClasses } from "@/lib/schedule";
import type { Exam } from "@/lib/types";

/** Today's classes, the next exams with a countdown, and mistakes waiting for review. */
export default function TodayStrip({
  now,
  exams,
  needs,
  reviewDue,
}: {
  now: number;
  exams: Exam[];
  needs: Record<string, GradeNeed>;
  reviewDue: number;
}) {
  const { slots, settings } = useSchedule();
  const colors = useCourseColors();
  const today = bangkokDateKey(now);
  const coming = upcomingClasses(slots, settings, now, 14);
  const todays = coming.filter((c) => c.date === today);
  const next = coming.find((c) => new Date(c.end).getTime() > now);
  const nextExams = exams.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now).slice(0, 3);

  return (
    <div className="mt-4 space-y-3">
      {reviewDue > 0 && (
        <Link
          href="/practice?review=1"
          className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-900 transition hover:bg-indigo-100"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <RotateCcw className="h-4 w-4" />
            {reviewDue} mistake{reviewDue > 1 ? "s" : ""} to review today
            <span className="hidden text-xs font-normal text-indigo-700 sm:inline">· about {Math.max(2, Math.round(reviewDue * 0.7))} min</span>
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <CalendarClock className="h-4 w-4" /> Today&apos;s classes
          </h2>
          {slots.length === 0 ? (
            <Link href="/schedule" className="text-sm font-medium text-tu-700 hover:underline">
              Add your timetable →
            </Link>
          ) : todays.length === 0 ? (
            <p className="text-sm text-slate-600">
              No class today.
              {next && (
                <>
                  {" "}
                  Next: <span className="font-mono font-semibold">{next.course_code}</span> {shortDate(next.date)}, {hhmm(next.slot.start_time)}
                </>
              )}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {todays.map((c) => {
                const start = new Date(c.start).getTime();
                const end = new Date(c.end).getTime();
                const state = now >= end ? "done" : now >= start ? "now" : "later";
                return (
                  <li
                    key={c.slot.id}
                    className={clsx(
                      "course-bar flex items-center gap-3 rounded-xl py-2 pl-3.5 pr-3",
                      colors[c.course_code] && `course-${colors[c.course_code]}`,
                      state === "done" ? "opacity-50" : "bg-slate-50",
                    )}
                  >
                    <span className="w-14 shrink-0 tabular-nums leading-tight">
                      <span className="block text-sm font-semibold text-slate-900">{hhmm(c.slot.start_time)}</span>
                      <span className="block text-xs text-slate-500">{hhmm(c.slot.end_time)}</span>
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-900">
                        <span className="course-dot" />
                        {c.course_code}
                        {c.n && <span className="font-sans text-xs font-normal text-slate-500">· Class {c.n}</span>}
                      </span>
                      {c.room && (
                        <span className="mt-0.5 flex items-center gap-0.5 truncate text-xs text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {c.room}
                        </span>
                      )}
                    </span>
                    {state === "now" && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Now</span>}
                    {state === "done" && <span className="shrink-0 text-xs text-slate-400">Done</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <GraduationCap className="h-4 w-4" /> Exams coming up
          </h2>
          {nextExams.length === 0 ? (
            <Link href="/schedule" className="text-sm font-medium text-tu-700 hover:underline">
              {exams.length ? "No exams in the next 2 months." : "Add your midterm & final dates →"}
            </Link>
          ) : (
            <div className="space-y-2">
              {nextExams.map((e) => (
                <ExamRow key={e.id} exam={e} need={needs[e.course_code]} now={now} compact />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
