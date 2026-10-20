"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import { toBangkokInputs } from "@/lib/dates";
import { EXAM_KIND_LABELS, type Course, type Exam, type ExamKind, type GradeComponent } from "@/lib/types";

const KINDS = Object.keys(EXAM_KIND_LABELS) as ExamKind[];

/** Add or edit an exam. */
export default function ExamModal({
  open,
  onClose,
  exam,
  courses,
  components,
  defaultCourse,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  exam: Exam | null;
  courses: Course[];
  components: GradeComponent[];
  defaultCourse?: string;
  onSaved: (exam: Exam) => void;
}) {
  const blank = { course_code: defaultCourse ?? courses[0]?.course_code ?? "", kind: "midterm" as ExamKind, title: "", date: "", start: "09:00", end: "12:00", room: "", notes: "", component_id: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (exam) {
      const s = toBangkokInputs(exam.starts_at);
      setForm({
        course_code: exam.course_code,
        kind: exam.kind,
        title: exam.title,
        date: s.date,
        start: s.time,
        end: exam.ends_at ? toBangkokInputs(exam.ends_at).time : "",
        room: exam.room ?? "",
        notes: exam.notes ?? "",
        component_id: exam.component_id ?? "",
      });
    } else setForm(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const courseParts = components.filter((c) => c.course_code === form.course_code);
  const autoTitle = `${form.course_code} ${EXAM_KIND_LABELS[form.kind]}${form.kind === "midterm" || form.kind === "final" ? " exam" : ""}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      kind: form.kind,
      title: form.title.trim() || autoTitle,
      starts_at: `${form.date}T${form.start || "09:00"}`,
      ends_at: form.end ? `${form.date}T${form.end}` : null,
      room: form.room.trim() || null,
      notes: form.notes.trim() || null,
      component_id: form.component_id || null,
    };
    try {
      const res = exam
        ? await api<{ exam: Exam }>(`/api/exams/${exam.id}`, { method: "PATCH", body })
        : await api<{ exam: Exam }>("/api/exams", { body: { ...body, course_code: form.course_code } });
      onSaved(res.exam);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={exam ? "Edit exam" : "Add exam"}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Course</label>
            <select className="input" value={form.course_code} onChange={(e) => set({ course_code: e.target.value, component_id: "" })} disabled={saving || Boolean(exam)}>
              {courses.map((c) => (
                <option key={c.course_code} value={c.course_code}>
                  {c.course_code} · {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.kind} onChange={(e) => set({ kind: e.target.value as ExamKind })} disabled={saving}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {EXAM_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.title} placeholder={autoTitle} onChange={(e) => set({ title: e.target.value })} disabled={saving} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1">
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} required disabled={saving} />
          </div>
          <div className="col-span-3 grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <label className="label">Starts</label>
              <input type="time" className="input" value={form.start} onChange={(e) => set({ start: e.target.value })} disabled={saving} />
            </div>
            <div>
              <label className="label">Ends</label>
              <input type="time" className="input" value={form.end} onChange={(e) => set({ end: e.target.value })} disabled={saving} />
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Room</label>
            <input className="input" value={form.room} placeholder="e.g. SC3-201" onChange={(e) => set({ room: e.target.value })} disabled={saving} />
          </div>
          <div>
            <label className="label">Counts towards</label>
            <select className="input" value={form.component_id} onChange={(e) => set({ component_id: e.target.value })} disabled={saving}>
              <option value="">{courseParts.length ? "— pick a grade part —" : "No grade parts yet"}</option>
              {courseParts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Number(p.weight)}%)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[64px]" value={form.notes} placeholder="Chapters, what to bring, open/closed book…" onChange={(e) => set({ notes: e.target.value })} disabled={saving} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !form.date || !form.course_code}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
