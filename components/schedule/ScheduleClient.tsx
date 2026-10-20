"use client";

import clsx from "clsx";
import { CalendarClock, CalendarOff, ChevronDown, GraduationCap, Hash, Loader2, MapPin, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCourseColors } from "@/components/CourseColors";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import type { GradeNeed } from "@/lib/grade-needs";
import { WEEKDAYS, bangkokDateKey, courseClasses, hhmm, shortDate, weekdayOf } from "@/lib/schedule";
import type { ClassSlot, Course, Exam, GradeComponent, NoClassPeriod, StudySettings } from "@/lib/types";
import ExamModal from "./ExamModal";
import ExamRow from "./ExamRow";
import ScheduleImportModal from "./ScheduleImportModal";

export default function ScheduleClient({
  courses,
  slots: initialSlots,
  settings: initialSettings,
  exams: initialExams,
  components,
  needs,
  serverNow,
  aiEnabled,
}: {
  courses: Course[];
  slots: ClassSlot[];
  settings: StudySettings | null;
  exams: Exam[];
  components: GradeComponent[];
  needs: Record<string, GradeNeed>;
  serverNow: number;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const colors = useCourseColors();
  const [slots, setSlots] = useState(initialSlots);
  const [exams, setExams] = useState(initialExams);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [examModal, setExamModal] = useState<{ open: boolean; exam: Exam | null }>({ open: false, exam: null });
  const [showPast, setShowPast] = useState(false);

  const today = bangkokDateKey(serverNow);
  const todayWeekday = weekdayOf(today);
  const usesWeekend = slots.some((s) => s.weekday >= 6);
  const days = usesWeekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const nowMs = serverNow;
  const upcoming = exams.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= nowMs - 3 * 3600e3).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = exams.filter((e) => !upcoming.includes(e)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  async function deleteSlot(slot: ClassSlot) {
    if (!confirm(`Remove ${slot.course_code} on ${WEEKDAYS[slot.weekday - 1]} ${hhmm(slot.start_time)}?`)) return;
    setSlots((s) => s.filter((x) => x.id !== slot.id));
    try {
      await api(`/api/schedule/slots/${slot.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
      setSlots(initialSlots);
    }
  }

  async function deleteExam(exam: Exam) {
    if (!confirm(`Delete "${exam.title}"?`)) return;
    setExams((e) => e.filter((x) => x.id !== exam.id));
    try {
      await api(`/api/exams/${exam.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Timetable</h1>
          <p className="text-sm text-slate-500">Your weekly classes, exams and semester dates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {aiEnabled && (
            <button className="btn-secondary" onClick={() => setImportOpen(true)}>
              <Sparkles className="h-4 w-4 text-gold-600" /> Import (AI)
            </button>
          )}
          <button className="btn-secondary" onClick={() => setExamModal({ open: true, exam: null })} disabled={!courses.length}>
            <GraduationCap className="h-4 w-4" /> Add exam
          </button>
          <button className="btn-primary" onClick={() => setAddOpen(true)} disabled={!courses.length}>
            <Plus className="h-4 w-4" /> Add class
          </button>
        </div>
      </div>

      {/* Week */}
      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <CalendarClock className="h-4 w-4" /> Every week
        </h2>
        {slots.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            No classes yet. {aiEnabled ? "Use Import (AI) with a screenshot of your timetable, or " : ""}click <strong>Add class</strong>.
          </div>
        ) : (
          <div className={clsx("grid gap-2", usesWeekend ? "sm:grid-cols-4 lg:grid-cols-7" : "sm:grid-cols-5")}>
            {days.map((d) => {
              const daySlots = slots.filter((s) => s.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
              const isToday = d === todayWeekday;
              return (
                <div key={d} className={clsx("rounded-2xl border p-2", isToday ? "border-slate-900 bg-surface shadow-card" : "border-slate-200 bg-slate-100/50")}>
                  <p className={clsx("px-1 pb-1.5 text-xs font-semibold", isToday ? "text-slate-900" : "text-slate-500")}>
                    {WEEKDAYS[d - 1]}
                    {isToday && <span className="ml-1.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-50">Today</span>}
                  </p>
                  {daySlots.length === 0 ? (
                    <p className="px-1 pb-1 text-xs text-slate-400">No class</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {daySlots.map((s) => (
                        <li key={s.id} className={clsx("course-bar group relative rounded-xl bg-surface py-2 pl-3 pr-2 shadow-sm", colors[s.course_code] && `course-${colors[s.course_code]}`)}>
                          <p className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900">
                            <span className="course-dot" />
                            {s.course_code}
                          </p>
                          <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                            {hhmm(s.start_time)}–{hhmm(s.end_time)}
                          </p>
                          {s.room && (
                            <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] text-slate-500">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {s.room}
                            </p>
                          )}
                          <button
                            onClick={() => deleteSlot(s)}
                            className="absolute right-1 top-1 rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label={`Remove ${s.course_code} ${WEEKDAYS[s.weekday - 1]}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Exams */}
      <section className="mt-8">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <GraduationCap className="h-4 w-4" /> Exams
        </h2>
        {upcoming.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">No upcoming exams. Add your midterms and finals so the countdown shows on the dashboard.</div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {upcoming.map((e) => (
              <ExamRow key={e.id} exam={e} need={needs[e.course_code]} now={nowMs} onEdit={() => setExamModal({ open: true, exam: e })} onDelete={() => deleteExam(e)} />
            ))}
          </div>
        )}
        {past.length > 0 && (
          <div className="mt-3">
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setShowPast((v) => !v)}>
              <ChevronDown className={clsx("h-4 w-4 transition", !showPast && "-rotate-90")} /> Past exams ({past.length})
            </button>
            {showPast && (
              <div className="mt-2 grid gap-2 opacity-70 lg:grid-cols-2">
                {past.map((e) => (
                  <ExamRow key={e.id} exam={e} now={nowMs} onEdit={() => setExamModal({ open: true, exam: e })} onDelete={() => deleteExam(e)} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <SemesterPanel settings={initialSettings} slots={slots} today={today} />

      <AddClassModal open={addOpen} onClose={() => setAddOpen(false)} courses={courses} onSaved={(s) => { setSlots((prev) => [...prev, ...s]); router.refresh(); }} />
      <ExamModal
        open={examModal.open}
        exam={examModal.exam}
        onClose={() => setExamModal({ open: false, exam: null })}
        courses={courses}
        components={components}
        onSaved={(saved) => {
          setExams((prev) => [...prev.filter((x) => x.id !== saved.id), saved]);
          router.refresh();
        }}
      />
      <ScheduleImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingSlots={slots.length}
        settings={initialSettings}
        onSaved={() => window.location.reload()}
      />
    </div>
  );
}

function AddClassModal({ open, onClose, courses, onSaved }: { open: boolean; onClose: () => void; courses: Course[]; onSaved: (slots: ClassSlot[]) => void }) {
  const [course, setCourse] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("12:30");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = course || courses[0]?.course_code || "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { slots } = await api<{ slots: ClassSlot[] }>("/api/schedule/slots", {
        body: { slots: weekdays.map((weekday) => ({ course_code: code, weekday, start_time: start, end_time: end, room: room.trim() || null })) },
      });
      onSaved(slots);
      setRoom("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Add class">
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="label">Course</label>
          <select className="input" value={code} onChange={(e) => setCourse(e.target.value)} disabled={saving}>
            {courses.map((c) => (
              <option key={c.course_code} value={c.course_code}>
                {c.course_code} · {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Day(s)</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = weekdays.includes(i + 1);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== i + 1) : [...w, i + 1].sort()))}
                  className={on ? "chip-on" : "chip-off"}
                  aria-pressed={on}
                >
                  {d.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Starts</label>
            <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} required disabled={saving} />
          </div>
          <div>
            <label className="label">Ends</label>
            <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} required disabled={saving} />
          </div>
        </div>
        <div>
          <label className="label">Room</label>
          <input className="input" value={room} placeholder="e.g. SC3-201" onChange={(e) => setRoom(e.target.value)} disabled={saving} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !code || !weekdays.length}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Semester start/end, breaks, and the resulting class numbers (so "Class 11" can be checked). */
function SemesterPanel({ settings, slots, today }: { settings: StudySettings | null; slots: ClassSlot[]; today: string }) {
  const router = useRouter();
  const colors = useCourseColors();
  const [start, setStart] = useState(settings?.semester_start ?? "");
  const [end, setEnd] = useState(settings?.semester_end ?? "");
  const [breaks, setBreaks] = useState<NoClassPeriod[]>(settings?.no_class_days ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotCourses = [...new Set(slots.map((s) => s.course_code))].sort();
  const [viewCourse, setViewCourse] = useState(slotCourses[0] ?? "");

  const draft: StudySettings = { user_id: "", semester_start: start || null, semester_end: end || null, no_class_days: breaks.filter((b) => b.start), updated_at: "" };
  const numbered = useMemo(() => (viewCourse ? courseClasses(slots, draft, viewCourse) : []), [slots, viewCourse, start, end, breaks]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextIndex = numbered.findIndex((c) => c.date >= today);
  // Open the list at the next class, not Class 1.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>("[data-next]");
    if (list && item) list.scrollTop = Math.max(0, item.offsetTop - list.offsetTop - 64);
  }, [viewCourse, nextIndex]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/schedule/settings", {
        method: "PUT",
        body: {
          semester_start: start || null,
          semester_end: end || null,
          no_class_days: breaks.filter((b) => b.start).map((b) => ({ ...b, end: b.end || b.start })),
        },
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 grid gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarOff className="h-5 w-5 text-tu-600" /> Semester dates
        </h2>
        <p className="mt-1 text-xs text-slate-500">Used to number your classes, so tasks like &ldquo;submit before Class 11&rdquo; get a real date.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">First day of classes</label>
            <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="label">Last day of classes</label>
            <input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} disabled={saving} />
          </div>
        </div>
        <p className="label mt-4">Days with no class (holidays, midterm week…)</p>
        <ul className="space-y-1.5">
          {breaks.map((b, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-2">
              <div className="flex items-center gap-1.5">
                <input type="date" className="input min-w-0 flex-1" value={b.start} onChange={(e) => setBreaks((bs) => bs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} aria-label="From" />
                <span className="text-xs text-slate-400">to</span>
                <input type="date" className="input min-w-0 flex-1" value={b.end} onChange={(e) => setBreaks((bs) => bs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} aria-label="To" />
                <button onClick={() => setBreaks((bs) => bs.filter((_, j) => j !== i))} className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input className="input mt-1.5" value={b.label} placeholder="What is it? e.g. Midterm week, Chulalongkorn Day" onChange={(e) => setBreaks((bs) => bs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Label" />
            </li>
          ))}
        </ul>
        <button className="btn-ghost mt-1.5 px-2 py-1 text-xs" onClick={() => setBreaks((bs) => [...bs, { start: "", end: "", label: "" }])}>
          <Plus className="h-3.5 w-3.5" /> Add day off
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-emerald-600">Saved ✓</span>}
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save dates
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Hash className="h-5 w-5 text-tu-600" /> Class numbers
        </h2>
        {!start || !slotCourses.length ? (
          <p className="mt-2 text-sm text-slate-500">Add your classes and the first day of classes to see which date is Class 1, Class 2…</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">Check one you know (e.g. your Class 11). If it&apos;s off, add the missing day off on the left.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {slotCourses.map((c) => (
                <button key={c} onClick={() => setViewCourse(c)} className={clsx(viewCourse === c ? "chip-on" : "chip-off", "font-mono", colors[c] && `course-${colors[c]}`)}>
                  <span className="course-dot" />
                  {c}
                </button>
              ))}
            </div>
            <ol ref={listRef} className="mt-3 max-h-80 space-y-0.5 overflow-y-auto pr-1 text-sm">
              {numbered.map((c, i) => (
                <li
                  key={`${c.date}-${c.slot.id}`}
                  data-next={i === nextIndex ? "" : undefined}
                  className={clsx(
                    "flex items-center justify-between rounded-lg px-2.5 py-1.5",
                    i === nextIndex ? "bg-slate-900 text-slate-50" : c.date < today ? "text-slate-400" : "text-slate-700",
                  )}
                >
                  <span className="font-medium">Class {c.n}</span>
                  <span className="tabular-nums">
                    {shortDate(c.date)} · {hhmm(c.slot.start_time)}
                    {i === nextIndex && <span className="ml-2 text-[10px] font-semibold uppercase">next</span>}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
