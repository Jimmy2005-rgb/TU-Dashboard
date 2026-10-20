"use client";

import clsx from "clsx";
import { ChevronDown, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/ui/api";
import { DEFAULT_GRADE_SCALE, scaleProblem, scaleRanges, type GradeScale } from "@/lib/grades";

type Row = { letter: string; min: string };

/**
 * Shows the letter-grade table in use (like the one in a course outline) and lets the
 * student edit it — for this course only, or as the default for every course.
 */
export default function GradeScaleEditor({
  courseCode,
  courseScale,
  defaultScale,
  onChange,
}: {
  courseCode: string;
  /** This course's override, or null. */
  courseScale: GradeScale | null;
  /** The student's saved default, or null (built-in default). */
  defaultScale: GradeScale | null;
  onChange: (next: { courseScale: GradeScale | null; defaultScale: GradeScale | null }) => void;
}) {
  const router = useRouter();
  const active = courseScale ?? defaultScale ?? DEFAULT_GRADE_SCALE;
  const source = courseScale ? `${courseCode} only` : defaultScale ? "your default" : "standard";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) setRows(active.map((g) => ({ letter: g.letter, min: String(g.min) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const draft: GradeScale = rows.map((r, i) => ({ letter: r.letter.trim(), min: i === rows.length - 1 ? 0 : Number(r.min) }));
  const problem = editing ? scaleProblem(draft) : null;

  async function save(where: "course" | "default" | "reset-course") {
    setSaving(where);
    setError(null);
    try {
      if (where === "default") {
        await api("/api/grade-scale", { method: "PUT", body: { grade_scale: draft } });
        onChange({ courseScale, defaultScale: draft });
      } else {
        const scale = where === "course" ? draft : null;
        await api(`/api/courses/${courseCode}`, { method: "PATCH", body: { grade_scale: scale } });
        onChange({ courseScale: scale, defaultScale });
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
        aria-expanded={open}
      >
        <span className="font-medium text-slate-800">
          Grade scale <span className="font-normal text-slate-500">· {source}</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline">
            {active[0].letter} ≥ {active[0].min} · {active[1]?.letter} {active[1]?.min}+ …
          </span>
          <ChevronDown className={clsx("h-4 w-4 transition", !open && "-rotate-90")} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 p-3">
          {!editing ? (
            <>
              <table className="w-full max-w-xs border-collapse text-sm">
                <thead>
                  <tr>
                    <th colSpan={2} className="border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold">
                      Grade Criteria
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scaleRanges(active).map((g) => (
                    <tr key={g.letter}>
                      <td className="w-16 border border-slate-200 px-3 py-1 text-center font-semibold">{g.letter}</td>
                      <td className="border border-slate-200 px-3 py-1 text-center tabular-nums">{g.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit scale
                </button>
                {courseScale && (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => save("reset-course")} disabled={Boolean(saving)}>
                    {saving === "reset-course" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Use my default for {courseCode}
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Scores are compared with the minimums as they are (84.6% is still B+ here) — if your professor rounds first, set the minimums to e.g. 84.5.
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">Type the lowest percent for each grade. The last grade always starts at 0.</p>
              <ul className="space-y-1.5">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      className="input w-20 text-center font-semibold uppercase"
                      value={r.letter}
                      onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, letter: e.target.value.toUpperCase() } : x)))}
                      aria-label={`Grade ${i + 1} letter`}
                      maxLength={4}
                    />
                    <span className="text-sm text-slate-400">from</span>
                    <div className="relative w-24">
                      <input
                        className="input pr-7 text-right tabular-nums"
                        inputMode="decimal"
                        value={i === rows.length - 1 ? "0" : r.min}
                        disabled={i === rows.length - 1}
                        onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))}
                        aria-label={`${r.letter || "Grade"} minimum percent`}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                    </div>
                    <span className="hidden w-20 text-xs tabular-nums text-slate-500 sm:inline">
                      {!problem && scaleRanges(draft)[i]?.range}
                    </span>
                    {rows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                        className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${r.letter}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => setRows((rs) => [...rs.slice(0, -1), { letter: "", min: "" }, rs[rs.length - 1]])}
                  disabled={rows.length >= 15}
                >
                  <Plus className="h-3.5 w-3.5" /> Add grade
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => setRows(DEFAULT_GRADE_SCALE.map((g) => ({ letter: g.letter, min: String(g.min) })))}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Standard (A ≥ 85)
                </button>
              </div>
              {(problem || error) && <p className="mt-2 text-sm text-red-600">{problem ?? error}</p>}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={Boolean(saving)}>
                  Cancel
                </button>
                <button type="button" className="btn-secondary" onClick={() => save("default")} disabled={Boolean(problem) || Boolean(saving)}>
                  {saving === "default" && <Loader2 className="h-4 w-4 animate-spin" />} Save for all my courses
                </button>
                <button type="button" className="btn-primary" onClick={() => save("course")} disabled={Boolean(problem) || Boolean(saving)}>
                  {saving === "course" && <Loader2 className="h-4 w-4 animate-spin" />} Save for {courseCode} only
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
