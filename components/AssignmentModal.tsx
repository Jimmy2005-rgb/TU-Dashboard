"use client";

import clsx from "clsx";
import { CalendarClock, CheckCircle2, Circle, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CourseBadge, PlatformBadge } from "@/components/ui/badges";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import { formatDue, relativeDue, toBangkokInputs } from "@/lib/dates";
import type { Assignment, SourcePlatform } from "@/lib/types";

/**
 * Full details of one assignment (nothing truncated), with an Edit mode for
 * fixing the course, title, due date, notes or link.
 */
export default function AssignmentModal({
  assignment,
  courses,
  onClose,
  onChanged,
  onDeleted,
}: {
  assignment: Assignment | null;
  courses: string[];
  onClose: () => void;
  onChanged: (a: Assignment) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => toForm(assignment));

  useEffect(() => {
    setEditing(false);
    setError(null);
    setForm(toForm(assignment));
  }, [assignment]);

  if (!assignment) return null;
  const a = assignment;
  const done = a.status === "completed";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const { assignment: updated } = await api<{ assignment: Assignment }>(`/api/assignments/${a.id}`, { method: "PATCH", body });
      onChanged(updated);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await patch({
      title: form.title,
      course_code: form.course_code || null,
      source_platform: form.source_platform,
      // "YYYY-MM-DDTHH:mm" is read as Bangkok time by the server.
      due_date: form.due_date ? `${form.due_date}T${form.due_time || "23:59"}` : null,
      description: form.description || null,
      external_link: form.external_link || null,
    });
    if (ok) setEditing(false);
  }

  async function remove() {
    if (!confirm(`Delete "${a.title}"?`)) return;
    setBusy(true);
    try {
      await api(`/api/assignments/${a.id}`, { method: "DELETE" });
      onDeleted(a.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof ReturnType<typeof toForm>>(k: K, v: ReturnType<typeof toForm>[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={() => !busy && onClose()} title={editing ? "Edit assignment" : "Assignment"} wide>
      {!editing ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {a.course_code ? (
                <Link href={`/courses/${a.course_code}`} onClick={onClose}>
                  <CourseBadge code={a.course_code} />
                </Link>
              ) : (
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  No course — click Edit to set one
                </span>
              )}
              <PlatformBadge platform={a.source_platform} />
              {done && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">Done</span>}
            </div>
            <h3 className={clsx("text-lg font-semibold leading-snug", done && "text-slate-400 line-through")}>{a.title}</h3>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
            <CalendarClock className="h-4 w-4 shrink-0 text-tu-600" />
            <span className="font-medium">{formatDue(a.due_date)}</span>
            {a.due_date && !done && <span className="text-slate-500">· {relativeDue(a.due_date)}</span>}
          </div>

          <div>
            <p className="label">Details</p>
            {a.description ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{a.description}</p>
            ) : (
              <p className="text-sm text-slate-400">No details saved.</p>
            )}
          </div>

          {a.external_link && (
            <a href={a.external_link} target="_blank" rel="noopener noreferrer" className="btn-secondary w-fit">
              <ExternalLink className="h-4 w-4" /> Open in {a.source_platform === "ms_teams" ? "Teams" : a.source_platform === "google_classroom" ? "Classroom" : "link"}
            </a>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700" onClick={remove} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setEditing(true)} disabled={busy}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button className="btn-primary" onClick={() => patch({ status: done ? "pending" : "completed" })} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Circle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {done ? "Mark as not done" : "Mark as done"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label" htmlFor="e-title">
              Title
            </label>
            <input id="e-title" className="input" value={form.title} onChange={(e) => set("title", e.target.value)} disabled={busy} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="e-course">
                Course
              </label>
              <input
                id="e-course"
                className="input font-mono uppercase"
                list="edit-assignment-courses"
                placeholder="e.g. IS201"
                value={form.course_code}
                onChange={(e) => set("course_code", e.target.value.toUpperCase())}
                disabled={busy}
              />
              <datalist id="edit-assignment-courses">
                {courses.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label" htmlFor="e-platform">
                Where it&apos;s submitted
              </label>
              <select
                id="e-platform"
                className="input"
                value={form.source_platform}
                onChange={(e) => set("source_platform", e.target.value as SourcePlatform)}
                disabled={busy}
              >
                <option value="manual">Other / in class</option>
                <option value="ms_teams">MS Teams</option>
                <option value="google_classroom">Google Classroom</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="e-date">
                Due date
              </label>
              <input id="e-date" type="date" className="input" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="label" htmlFor="e-time">
                Due time (Bangkok)
              </label>
              <input
                id="e-time"
                type="time"
                className="input"
                value={form.due_time}
                onChange={(e) => set("due_time", e.target.value)}
                disabled={busy || !form.due_date}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="e-desc">
              Details
            </label>
            <textarea
              id="e-desc"
              className="input min-h-[140px] leading-relaxed"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label className="label" htmlFor="e-link">
              Link
            </label>
            <input
              id="e-link"
              className="input"
              placeholder="https://… (optional)"
              value={form.external_link}
              onChange={(e) => set("external_link", e.target.value)}
              disabled={busy}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !form.title.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function toForm(a: Assignment | null) {
  const due = toBangkokInputs(a?.due_date ?? null);
  return {
    title: a?.title ?? "",
    course_code: a?.course_code ?? "",
    source_platform: (a?.source_platform ?? "manual") as SourcePlatform,
    due_date: due.date,
    due_time: due.time,
    description: a?.description ?? "",
    external_link: a?.external_link ?? "",
  };
}
