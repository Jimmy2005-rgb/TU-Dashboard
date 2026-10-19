"use client";

import { CalendarDays, CheckCircle2, Loader2, ScrollText, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import FileDrop from "@/components/ui/FileDrop";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import { formatDue } from "@/lib/dates";
import type { ParsedOutline } from "@/lib/schemas";
import type { GradeComponent } from "@/lib/types";

type Part = { name: string; weight: string; description: string | null };

/**
 * Drop a course outline → the AI reads the grading breakdown and dated
 * deadlines → the student reviews/edits them → save.
 */
export default function OutlineImportModal({
  open,
  onClose,
  courseCode,
  existingParts,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  courseCode: string;
  existingParts: number;
  onSaved: (components: GradeComponent[], deadlinesAdded: number) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<Part[] | null>(null);
  const [deadlines, setDeadlines] = useState<(ParsedOutline["deadlines"][number] & { keep: boolean })[]>([]);
  const [replace, setReplace] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setText("");
    setParts(null);
    setDeadlines([]);
    setError(null);
    setReplace(true);
  }, [open]);

  const busy = reading || saving;
  const total = (parts ?? []).reduce((n, p) => n + (Number(p.weight) || 0), 0);

  async function read() {
    setReading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("course_code", courseCode);
      form.set("text", text);
      files.forEach((f) => form.append("files", f));
      const { outline } = await api<{ outline: ParsedOutline }>("/api/parse-outline", { body: form });
      if (!outline.components.length && !outline.deadlines.length) {
        setError("Couldn't find a grading breakdown or dates in that. Try the page that lists the assessment weights.");
        return;
      }
      setParts(outline.components.map((c) => ({ name: c.name, weight: String(c.weight), description: c.description })));
      setDeadlines(outline.deadlines.map((d) => ({ ...d, keep: true })));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!parts) return;
    setSaving(true);
    setError(null);
    try {
      let saved: GradeComponent[] = [];
      const valid = parts.filter((p) => p.name.trim());
      if (valid.length) {
        const res = await api<{ components: GradeComponent[] }>(`/api/courses/${courseCode}/grades`, {
          body: {
            replace: existingParts > 0 && replace,
            components: valid.map((p) => ({ name: p.name.trim(), weight: Number(p.weight) || 0, description: p.description })),
          },
        });
        saved = res.components;
      }
      const chosen = deadlines.filter((d) => d.keep);
      for (const d of chosen) {
        await api("/api/assignments", {
          body: { title: d.title, course_code: courseCode, source_platform: "manual", due_date: d.due_date, description: d.description },
        });
      }
      onSaved(saved, chosen.length);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={`Import course outline · ${courseCode}`}
      description="The AI reads the grading weights and exam dates. You can check and edit them before saving."
      wide
    >
      {!parts ? (
        <div className="space-y-3">
          <FileDrop files={files} onChange={setFiles} disabled={busy} hint="Course outline / syllabus PDF, or a photo of the grading table" />
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or paste text <span className="h-px flex-1 bg-slate-200" />
          </div>
          <textarea
            className="input min-h-[140px] font-mono text-xs leading-relaxed"
            placeholder={"e.g.\nMidterm examination 30%\nFinal examination 35%\nQuizzes (5) 10%\nGroup project 15%\nClass participation 10%"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={read} disabled={busy || (files.length === 0 && text.trim().length < 10)}>
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {reading ? "Reading outline…" : "Read outline"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4 text-tu-600" /> Grading breakdown
              <span className={total === 100 ? "text-xs font-medium text-emerald-600" : "text-xs font-medium text-amber-600"}>
                total {Number(total.toFixed(2))}%{total === 100 ? " ✓" : " — should be 100%"}
              </span>
            </h3>
            {parts.length === 0 ? (
              <p className="text-sm text-slate-500">No grading weights found — you can add parts by hand later.</p>
            ) : (
              <ul className="space-y-1.5">
                {parts.map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      value={p.name}
                      onChange={(e) => setParts((ps) => ps!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      disabled={busy}
                      aria-label="Part name"
                    />
                    <div className="relative w-24 shrink-0">
                      <input
                        className="input pr-7 text-right"
                        inputMode="decimal"
                        value={p.weight}
                        onChange={(e) => setParts((ps) => ps!.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))}
                        disabled={busy}
                        aria-label="Weight percent"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setParts((ps) => ps!.filter((_, j) => j !== i))}
                      className="shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Remove part"
                      disabled={busy}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {existingParts > 0 && parts.length > 0 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                  className="rounded border-slate-300 text-tu-600 focus:ring-tu-500"
                />
                Replace the {existingParts} existing part{existingParts > 1 ? "s" : ""} (their recorded scores will be removed)
              </label>
            )}
          </section>

          {deadlines.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-tu-600" /> Dates found — add to dashboard?
              </h3>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {deadlines.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={d.keep}
                      onChange={(e) => setDeadlines((ds) => ds.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                      className="rounded border-slate-300 text-tu-600 focus:ring-tu-500"
                      aria-label={`Add ${d.title}`}
                      disabled={busy}
                    />
                    <span className="min-w-0 flex-1 truncate">{d.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDue(d.due_date)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setParts(null)} disabled={busy}>
              Back
            </button>
            <button className="btn-primary" onClick={save} disabled={busy || (parts.length === 0 && !deadlines.some((d) => d.keep))}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
