"use client";

import { CalendarClock, CalendarOff, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import FileDrop from "@/components/ui/FileDrop";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import { formatDue } from "@/lib/dates";
import type { ParsedSchedule } from "@/lib/schemas";
import { WEEKDAYS, shortDate } from "@/lib/schedule";
import { EXAM_KIND_LABELS, type ExamKind, type StudySettings } from "@/lib/types";

type Keep<T> = T & { keep: boolean };

/**
 * Drop a timetable / exam schedule / academic calendar → the AI reads it →
 * the student ticks what to keep → save.
 */
export default function ScheduleImportModal({
  open,
  onClose,
  existingSlots,
  settings,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existingSlots: number;
  settings: StudySettings | null;
  onSaved: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedSchedule | null>(null);
  const [classes, setClasses] = useState<Keep<ParsedSchedule["classes"][number]>[]>([]);
  const [exams, setExams] = useState<Keep<ParsedSchedule["exams"][number]>[]>([]);
  const [useDates, setUseDates] = useState(true);
  const [replace, setReplace] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setText("");
    setResult(null);
    setError(null);
    setReplace(true);
    setUseDates(true);
  }, [open]);

  const busy = reading || saving;

  async function read() {
    setReading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("text", text);
      files.forEach((f) => form.append("files", f));
      const { schedule } = await api<{ schedule: ParsedSchedule }>("/api/parse-schedule", { body: form });
      const nothing = !schedule.classes.length && !schedule.exams.length && !schedule.semester_start && !schedule.no_class_days.length;
      if (nothing) {
        setError("Couldn't find classes, exams or semester dates in that. Try a clearer screenshot of the timetable.");
        return;
      }
      setResult(schedule);
      setClasses(schedule.classes.map((c) => ({ ...c, keep: true })));
      setExams(schedule.exams.map((e) => ({ ...e, keep: true })));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReading(false);
    }
  }

  const hasDates = Boolean(result && (result.semester_start || result.semester_end || result.no_class_days.length));

  async function save() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const keptClasses = classes.filter((c) => c.keep);
      if (keptClasses.length) {
        await api("/api/schedule/slots", {
          body: {
            replace: existingSlots > 0 && replace,
            slots: keptClasses.map((c) => ({
              course_code: c.course_code,
              weekday: c.weekday,
              start_time: c.start_time,
              end_time: c.end_time,
              room: c.room,
              section: c.section,
            })),
          },
        });
      }
      for (const e of exams.filter((x) => x.keep)) {
        await api("/api/exams", {
          body: { course_code: e.course_code, kind: e.kind, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, room: e.room },
        });
      }
      if (hasDates && useDates) {
        // Merge with what's already saved: new values win, breaks are combined.
        const seen = new Set<string>();
        const noClass = [...(settings?.no_class_days ?? []), ...result.no_class_days].filter((p) => {
          const k = `${p.start}|${p.end}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        await api("/api/schedule/settings", {
          method: "PUT",
          body: {
            semester_start: result.semester_start ?? settings?.semester_start ?? null,
            semester_end: result.semester_end ?? settings?.semester_end ?? null,
            no_class_days: noClass,
          },
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const kept = classes.filter((c) => c.keep).length + exams.filter((e) => e.keep).length + (hasDates && useDates ? 1 : 0);

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Import timetable & exams"
      description="Drop a screenshot of your timetable (reg.tu.ac.th), an exam schedule or the academic calendar. You check everything before it's saved."
      wide
    >
      {!result ? (
        <div className="space-y-3">
          <FileDrop files={files} onChange={setFiles} disabled={busy} hint="Timetable screenshot, exam schedule or calendar (PDF or image)" />
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or paste text <span className="h-px flex-1 bg-slate-200" />
          </div>
          <textarea
            className="input min-h-[140px] font-mono text-xs leading-relaxed"
            placeholder={"e.g.\nAC201  Mon 09:30-12:30  SC3-201\nFN201  Wed 13:30-16:30  BBA 402\nMidterm AC201: 14 Sep 2026 09:00-12:00\nClasses start 10 Aug 2026, midterm week 14-18 Sep"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={read} disabled={busy || (files.length === 0 && text.trim().length < 5)}>
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {reading ? "Reading…" : "Read it"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {classes.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-tu-600" /> Weekly classes
              </h3>
              <ul className="space-y-1">
                {classes.map((c, i) => (
                  <li key={i}>
                    <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={c.keep}
                        onChange={(e) => setClasses((cs) => cs.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                        className="rounded border-slate-300 text-tu-600 focus:ring-tu-500"
                      />
                      <span className="w-16 font-mono text-xs font-semibold">{c.course_code}</span>
                      <span className="w-24">{WEEKDAYS[c.weekday - 1]}</span>
                      <span className="tabular-nums">
                        {c.start_time}–{c.end_time}
                      </span>
                      <span className="truncate text-xs text-slate-500">{c.room}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {existingSlots > 0 && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="rounded border-slate-300 text-tu-600 focus:ring-tu-500" />
                  Replace my current timetable ({existingSlots} class time{existingSlots > 1 ? "s" : ""})
                </label>
              )}
            </section>
          )}

          {exams.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="h-4 w-4 text-tu-600" /> Exams
              </h3>
              <ul className="space-y-1">
                {exams.map((e, i) => (
                  <li key={i}>
                    <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={e.keep}
                        onChange={(ev) => setExams((es) => es.map((x, j) => (j === i ? { ...x, keep: ev.target.checked } : x)))}
                        className="rounded border-slate-300 text-tu-600 focus:ring-tu-500"
                      />
                      <span className="w-16 font-mono text-xs font-semibold">{e.course_code}</span>
                      <span className="w-24 text-xs uppercase text-slate-500">{EXAM_KIND_LABELS[e.kind as ExamKind] ?? e.kind}</span>
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatDue(e.starts_at)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasDates && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CalendarOff className="h-4 w-4 text-tu-600" /> Semester dates
              </h3>
              <label className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={useDates} onChange={(e) => setUseDates(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-tu-600 focus:ring-tu-500" />
                <span className="space-y-0.5">
                  {result.semester_start && <span className="block">Classes start {shortDate(result.semester_start)}</span>}
                  {result.semester_end && <span className="block">Classes end {shortDate(result.semester_end)}</span>}
                  {result.no_class_days.map((p, i) => (
                    <span key={i} className="block text-slate-600">
                      No class: {shortDate(p.start)}
                      {p.end !== p.start ? ` – ${shortDate(p.end)}` : ""} {p.label && `(${p.label})`}
                    </span>
                  ))}
                </span>
              </label>
            </section>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setResult(null)} disabled={busy}>
              Back
            </button>
            <button className="btn-primary" onClick={save} disabled={busy || kept === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
