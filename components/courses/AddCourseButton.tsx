"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import type { Course } from "@/lib/types";

export default function AddCourseButton({ existing }: { existing?: Course }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    course_code: existing?.course_code ?? "",
    name: existing?.name ?? "",
    professor: existing?.professor ?? "",
    semester: existing?.semester ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/courses", { body: form });
      setOpen(false);
      if (!existing) setForm({ course_code: "", name: "", professor: "", semester: "" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
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
        {existing ? "Edit course" : (
          <>
            <Plus className="h-4 w-4" /> Add course
          </>
        )}
      </button>
      <Modal open={open} onClose={() => !loading && setOpen(false)} title={existing ? "Edit course" : "Add course"}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("course_code", "Course code", "FN201", "font-mono uppercase")}
            {field("semester", "Semester", "1/2026")}
          </div>
          {field("name", "Course name", "Business Finance")}
          {field("professor", "Professor", "Asst. Prof. Dr. …")}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
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
