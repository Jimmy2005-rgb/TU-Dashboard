"use client";

import clsx from "clsx";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCourseColors } from "@/components/CourseColors";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import { COURSE_COLOR_COUNT, COURSE_COLOR_NAMES } from "@/lib/course-colors";
import type { Course } from "@/lib/types";

export default function AddCourseButton({ existing }: { existing?: Course }) {
  const router = useRouter();
  const colors = useCourseColors();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    course_code: existing?.course_code ?? "",
    name: existing?.name ?? "",
    professor: existing?.professor ?? "",
    semester: existing?.semester ?? "",
  });
  // null = automatic. Show the colour the course currently has.
  const [color, setColor] = useState<number | null>(existing?.color ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const shownColor = color ?? (existing ? colors[existing.course_code] : null);
  const usedBy = (slot: number) =>
    Object.entries(colors)
      .filter(([code, c]) => c === slot && code !== existing?.course_code)
      .map(([code]) => code);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/courses", { body: { ...form, color } });
      setOpen(false);
      if (!existing) {
        setForm({ course_code: "", name: "", professor: "", semester: "" });
        setColor(null);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteCourse() {
    if (!existing) return;
    setLoading(true);
    setError(null);
    try {
      await api(`/api/courses/${existing.course_code}`, { method: "DELETE" });
      setOpen(false);
      router.push("/courses");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  const field = (key: keyof typeof form, label: string, placeholder: string, extra?: string) => (
    <div>
      <label className="label">{label}</label>
      <input
        className={`input ${extra ?? ""}`}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        disabled={loading || (key === "course_code" && Boolean(existing))}
      />
    </div>
  );

  return (
    <>
      <button className={existing ? "btn-secondary" : "btn-primary"} onClick={() => setOpen(true)}>
        {existing ? (
          "Edit course"
        ) : (
          <>
            <Plus className="h-4 w-4" /> Add course
          </>
        )}
      </button>
      <Modal
        open={open}
        onClose={() => {
          if (loading) return;
          setOpen(false);
          setConfirmDelete(false);
        }} title={existing ? "Edit course" : "Add course"}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("course_code", "Course code", "FN201", "font-mono uppercase")}
            {field("semester", "Semester", "1/2026")}
          </div>
          {field("name", "Course name", "Business Finance")}
          {field("professor", "Professor", "Asst. Prof. Dr. …")}

          <div>
            <span className="label">Colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: COURSE_COLOR_COUNT }, (_, i) => i + 1).map((slot) => {
                const others = usedBy(slot);
                const selected = shownColor === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setColor(slot)}
                    className={clsx(
                      `course-${slot} flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition`,
                      selected ? "ring-2 ring-slate-900" : "hover:scale-110",
                    )}
                    style={{ background: "var(--course)" }}
                    aria-label={`${COURSE_COLOR_NAMES[slot - 1]}${others.length ? ` (also ${others.join(", ")})` : ""}`}
                    title={`${COURSE_COLOR_NAMES[slot - 1]}${others.length ? ` — also used by ${others.join(", ")}` : ""}`}
                  >
                    {selected && <Check className="h-4 w-4 text-white" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setColor(null)}
                className={clsx("chip", color === null ? "border-slate-900 text-slate-900" : "border-slate-200 text-slate-500")}
              >
                Auto
              </button>
            </div>
            {shownColor && usedBy(shownColor).length > 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                {COURSE_COLOR_NAMES[shownColor - 1]} is also used by {usedBy(shownColor).join(", ")} — pick another if that&apos;s confusing.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {existing && confirmDelete && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Delete {existing.course_code} for good?</p>
              <p className="mt-1 text-xs leading-relaxed">
                This removes the course and everything in it: assignments, saved questions, uploaded files, grades, timetable, exams and
                practice history. It can&apos;t be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn bg-red-600 text-white hover:bg-red-700" onClick={deleteCourse} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Yes, delete {existing.course_code}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={loading}>
                  Keep it
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {existing && !confirmDelete && (
              <button
                type="button"
                className="btn-ghost mr-auto text-red-600 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" /> Delete course
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !form.course_code || !form.name}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
