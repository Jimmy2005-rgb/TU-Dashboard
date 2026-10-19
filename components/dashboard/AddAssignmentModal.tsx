"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import type { Assignment, SourcePlatform } from "@/lib/types";

const EMPTY = {
  title: "",
  course_code: "",
  source_platform: "manual" as SourcePlatform,
  due_date: "",
  due_time: "23:59",
  description: "",
  external_link: "",
};

/** Plain form for adding an assignment by hand — works without any AI key. */
export default function AddAssignmentModal({
  open,
  onClose,
  courses,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  courses: string[];
  onCreated: (assignment: Assignment) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [key]: value }));

  function close() {
    if (loading) return;
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent, addAnother = false) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { assignment } = await api<{ assignment: Assignment }>("/api/assignments", {
        body: {
          title: form.title,
          course_code: form.course_code || null,
          source_platform: form.source_platform,
          // "YYYY-MM-DDTHH:mm" is read as Bangkok time by the server.
          due_date: form.due_date ? `${form.due_date}T${form.due_time || "23:59"}` : null,
          description: form.description || null,
          external_link: form.external_link || null,
        },
      });
      onCreated(assignment);
      // Keep course and platform when adding several in a row.
      setForm({ ...EMPTY, course_code: form.course_code, source_platform: form.source_platform });
      if (!addAnother) onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Add assignment" description="Type in a deadline yourself.">
      <form onSubmit={(e) => submit(e)} className="space-y-3">
        <div>
          <label className="label" htmlFor="a-title">
            Title
          </label>
          <input
            id="a-title"
            className="input"
            placeholder="e.g. Problem Set 2: Time Value of Money"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
            disabled={loading}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="a-course">
              Course
            </label>
            <input
              id="a-course"
              className="input font-mono uppercase"
              list="add-assignment-courses"
              placeholder="FN201 (optional)"
              value={form.course_code}
              onChange={(e) => set("course_code", e.target.value.toUpperCase())}
              disabled={loading}
            />
            <datalist id="add-assignment-courses">
              {courses.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="a-platform">
              Where it&apos;s submitted
            </label>
            <select
              id="a-platform"
              className="input"
              value={form.source_platform}
              onChange={(e) => set("source_platform", e.target.value as SourcePlatform)}
              disabled={loading}
            >
              <option value="manual">Other / in class</option>
              <option value="ms_teams">MS Teams</option>
              <option value="google_classroom">Google Classroom</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="a-date">
              Due date
            </label>
            <input
              id="a-date"
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="label" htmlFor="a-time">
              Due time (Bangkok)
            </label>
            <input
              id="a-time"
              type="time"
              className="input"
              value={form.due_time}
              onChange={(e) => set("due_time", e.target.value)}
              disabled={loading || !form.due_date}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="a-notes">
            Notes
          </label>
          <textarea
            id="a-notes"
            className="input min-h-[70px]"
            placeholder="Requirements, weighting, group members… (optional)"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="label" htmlFor="a-link">
            Link
          </label>
          <input
            id="a-link"
            className="input"
            placeholder="https://classroom.google.com/… (optional)"
            value={form.external_link}
            onChange={(e) => set("external_link", e.target.value)}
            disabled={loading}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={close} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn-secondary" onClick={(e) => submit(e, true)} disabled={loading || !form.title.trim()}>
            Save &amp; add another
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !form.title.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
