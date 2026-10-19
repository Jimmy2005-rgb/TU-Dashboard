"use client";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import FileDrop from "@/components/ui/FileDrop";
import Modal from "@/components/ui/Modal";
import { CourseBadge } from "@/components/ui/badges";
import { api } from "@/components/ui/api";
import { formatDue } from "@/lib/dates";
import type { Assignment, SourcePlatform } from "@/lib/types";

const PLACEHOLDER = `Paste anything with deadlines, e.g.

FN201 Business Finance — Section 650001
Problem Set 2 (Time Value of Money) due Friday 7 Nov, 23:59 via Google Classroom
Midterm exam: 18 November 2026, 9:00–12:00, room SC3005
Group case report (20%) — submit on Teams by end of Week 10`;

export default function QuickAddModal({
  open,
  onClose,
  courses,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  courses: string[];
  onCreated: (assignments: Assignment[]) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [platform, setPlatform] = useState<SourcePlatform>("manual");
  const [defaultCourse, setDefaultCourse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Assignment[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function close() {
    if (loading) return;
    setCreated(null);
    setMessage(null);
    setError(null);
    onClose();
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("text", text);
      form.set("source_platform", platform);
      if (defaultCourse) form.set("default_course_code", defaultCourse);
      files.forEach((f) => form.append("files", f));
      const res = await api<{ assignments: Assignment[]; message?: string }>("/api/parse-assignment", { body: form });
      setCreated(res.assignments);
      setMessage(res.message ?? null);
      if (res.assignments.length) {
        onCreated(res.assignments);
        setText("");
        setFiles([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Paste or Drop Syllabus"
      description="AI extracts every deadline and saves it to your dashboard."
      wide
    >
      {created && created.length > 0 ? (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Added {created.length} item{created.length > 1 ? "s" : ""}
          </p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {created.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <CourseBadge code={a.course_code} />
                  <span className="truncate">{a.title}</span>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{formatDue(a.due_date)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setCreated(null)}>
              Add more
            </button>
            <button className="btn-primary" onClick={close}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <FileDrop files={files} onChange={setFiles} disabled={loading} hint="Syllabus PDF, course outline, or a photo of an announcement" />
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or paste text <span className="h-px flex-1 bg-slate-200" />
          </div>
          <textarea
            className="input min-h-[180px] font-mono text-xs leading-relaxed"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Source</label>
              <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value as SourcePlatform)}>
                <option value="manual">Manual / syllabus</option>
                <option value="ms_teams">MS Teams</option>
                <option value="google_classroom">Google Classroom</option>
              </select>
            </div>
            <div>
              <label className="label">Default course (if text doesn&apos;t say)</label>
              <select className="input" value={defaultCourse} onChange={(e) => setDefaultCourse(e.target.value)}>
                <option value="">Auto-detect</option>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {message && <p className="text-sm text-amber-700">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={close} disabled={loading}>
              Cancel
            </button>
            <button className="btn-primary" onClick={submit} disabled={loading || (text.trim().length < 5 && files.length === 0)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "AI is reading…" : "Extract & Save"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
