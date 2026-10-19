"use client";

import clsx from "clsx";
import { AlertTriangle, Check, ChevronDown, GraduationCap, Loader2, Pencil, Plus, ScrollText, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/ui/api";
import { formatDate } from "@/lib/dates";
import { fmtPct, LETTER_SCALE, letterFor, neededOnRemaining, summarize, type ComponentResult } from "@/lib/grades";
import type { Course, GradeComponent, GradeItem } from "@/lib/types";
import OutlineImportModal from "./OutlineImportModal";

const TARGETS = LETTER_SCALE.filter((g) => g.letter !== "F");

export default function GradesPanel({
  course,
  initialComponents,
  initialItems,
  aiEnabled,
}: {
  course: Course;
  initialComponents: GradeComponent[];
  initialItems: GradeItem[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [components, setComponents] = useState(initialComponents);
  const [items, setItems] = useState(initialItems);
  const [target, setTarget] = useState(Number(course.target_percent ?? 80));
  const [open, setOpen] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [newPart, setNewPart] = useState({ name: "", weight: "" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Pick up fresh server data after router.refresh() (e.g. after an outline import).
  useEffect(() => setComponents(initialComponents), [initialComponents]);
  useEffect(() => setItems(initialItems), [initialItems]);

  const summary = useMemo(() => summarize(components, items), [components, items]);
  const needed = neededOnRemaining(summary, target);
  const targetLetter = letterFor(target);

  async function changeTarget(value: number) {
    const before = target;
    setTarget(value);
    try {
      await api(`/api/courses/${course.course_code}`, { method: "PATCH", body: { target_percent: value } });
    } catch (err) {
      setTarget(before);
      setError((err as Error).message);
    }
  }

  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const { components: created } = await api<{ components: GradeComponent[] }>(`/api/courses/${course.course_code}/grades`, {
        body: { components: [{ name: newPart.name, weight: Number(newPart.weight) || 0 }] },
      });
      setComponents((c) => [...c, ...created]);
      setNewPart({ name: "", weight: "" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function updatePart(id: string, patch: { name?: string; weight?: number }) {
    const { component } = await api<{ component: GradeComponent }>(`/api/grades/components/${id}`, { method: "PATCH", body: patch });
    setComponents((cs) => cs.map((c) => (c.id === id ? component : c)));
    router.refresh();
  }

  async function deletePart(part: ComponentResult) {
    const extra = part.items.length ? ` and its ${part.items.length} recorded score${part.items.length > 1 ? "s" : ""}` : "";
    if (!confirm(`Delete "${part.component.name}"${extra}?`)) return;
    try {
      await api(`/api/grades/components/${part.component.id}`, { method: "DELETE" });
      setComponents((cs) => cs.filter((c) => c.id !== part.component.id));
      setItems((is) => is.filter((i) => i.component_id !== part.component.id));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteItem(item: GradeItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await api(`/api/grades/items/${item.id}`, { method: "DELETE" });
      setItems((is) => is.filter((i) => i.id !== item.id));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const hasParts = components.length > 0;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <GraduationCap className="h-5 w-5 text-tu-600" /> Grades
        </h2>
        <button
          className="btn-secondary"
          onClick={() => setImportOpen(true)}
          disabled={!aiEnabled}
          title={aiEnabled ? undefined : "AI is off: add a free GEMINI_API_KEY in Vercel to turn it on"}
        >
          <ScrollText className="h-4 w-4 text-tu-600" /> Import course outline (AI)
        </button>
      </div>

      {notice && (
        <p className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}

      {!hasParts ? (
        <p className="mt-3 text-sm text-slate-500">
          Add how this course is graded (e.g. Midterm 30%, Final 40%, Quizzes 10%, Project 20%)
          {aiEnabled ? " — or import it straight from the course outline PDF." : "."} Then record your scores to see your grade so far.
        </p>
      ) : (
        <>
          {/* Summary */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Grade so far</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{fmtPct(summary.currentPercent)}</span>
                <span className="rounded bg-tu-50 px-1.5 py-0.5 text-sm font-semibold text-tu-700">{letterFor(summary.currentPercent)}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {summary.gradedWeight > 0
                  ? `from ${fmtPct(summary.gradedWeight, 0)} of the course graded`
                  : "add a score to see this"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <label className="text-xs text-slate-500" htmlFor="grade-target">
                Aiming for
              </label>
              <select
                id="grade-target"
                className="input mt-1 py-1.5"
                value={TARGETS.some((t) => t.min === target) ? target : ""}
                onChange={(e) => changeTarget(Number(e.target.value))}
              >
                {!TARGETS.some((t) => t.min === target) && <option value="">{fmtPct(target, 0)}</option>}
                {TARGETS.map((t) => (
                  <option key={t.letter} value={t.min}>
                    {t.letter} ({t.min}%+)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Possible final: {fmtPct(summary.minPossible, 0)}–{fmtPct(summary.maxPossible, 0)}
              </p>
            </div>

            <div
              className={clsx(
                "rounded-lg border p-3",
                needed == null
                  ? "border-slate-200"
                  : needed <= 0
                    ? "border-emerald-200 bg-emerald-50"
                    : needed > 100
                      ? "border-red-200 bg-red-50"
                      : needed > 85
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200",
              )}
            >
              <p className="text-xs text-slate-500">To get {targetLetter}</p>
              {needed == null ? (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Everything is graded — final {fmtPct(summary.currentPercent)} ({letterFor(summary.currentPercent)})
                </p>
              ) : needed <= 0 ? (
                <p className="mt-1 text-sm font-semibold text-emerald-700">Already secured 🎉</p>
              ) : needed > 100 ? (
                <p className="mt-1 text-sm font-semibold text-red-700">Not reachable any more — max is {fmtPct(summary.maxPossible, 0)}</p>
              ) : (
                <p className="mt-1">
                  <span className="text-2xl font-bold">{fmtPct(needed, 0)}</span>
                  <span className="ml-1 text-sm text-slate-600">average</span>
                </p>
              )}
              {needed != null && needed > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">on the remaining {fmtPct(summary.remainingWeight, 0)} ({remainingNames(summary.parts)})</p>
              )}
            </div>
          </div>

          {Math.abs(summary.totalWeight - 100) > 0.01 && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Weights add up to {fmtPct(summary.totalWeight)} — check the course outline (they should total 100%).
            </p>
          )}

          {/* Parts */}
          <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {summary.parts.map((part) => (
              <PartRow
                key={part.component.id}
                part={part}
                expanded={open === part.component.id}
                onToggle={() => setOpen((o) => (o === part.component.id ? null : part.component.id))}
                onUpdate={(patch) => updatePart(part.component.id, patch)}
                onDelete={() => deletePart(part)}
                onItemAdded={(item) => {
                  setItems((is) => [...is, item]);
                  router.refresh();
                }}
                onItemDelete={deleteItem}
              />
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">
            Letter grades use the common TU cut-offs (A 80, B+ 75, B 70, C+ 65, C 60, D+ 55, D 50); your professor may curve differently.
            Parts with only some results use your average so far.
          </p>
        </>
      )}

      {/* Add part */}
      <form onSubmit={addPart} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="input min-w-[10rem] flex-1"
          placeholder="Add a graded part, e.g. Midterm exam"
          value={newPart.name}
          onChange={(e) => setNewPart((p) => ({ ...p, name: e.target.value }))}
          disabled={adding}
          aria-label="Part name"
        />
        <div className="relative w-24">
          <input
            className="input pr-7 text-right"
            placeholder="30"
            inputMode="decimal"
            value={newPart.weight}
            onChange={(e) => setNewPart((p) => ({ ...p, weight: e.target.value }))}
            disabled={adding}
            aria-label="Weight percent"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
        </div>
        <button type="submit" className="btn-primary" disabled={adding || !newPart.name.trim() || newPart.weight === ""}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add part
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <OutlineImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        courseCode={course.course_code}
        existingParts={components.length}
        onSaved={(saved, deadlinesAdded) => {
          // The import may have replaced parts, so reload parts and scores from the server.
          setNotice(
            [saved.length ? `Saved ${saved.length} graded parts` : "", deadlinesAdded ? `added ${deadlinesAdded} dates to your dashboard` : ""]
              .filter(Boolean)
              .join(" and ") + ".",
          );
          router.refresh();
        }}
      />
    </section>
  );
}

function remainingNames(parts: ComponentResult[]) {
  const names = parts.filter((p) => p.percent == null).map((p) => p.component.name);
  return names.length > 3 ? `${names.slice(0, 3).join(", ")}…` : names.join(", ");
}

function PartRow({
  part,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onItemAdded,
  onItemDelete,
}: {
  part: ComponentResult;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: { name?: string; weight?: number }) => Promise<void>;
  onDelete: () => void;
  onItemAdded: (item: GradeItem) => void;
  onItemDelete: (item: GradeItem) => void;
}) {
  const { component, items, percent, points } = part;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: component.name, weight: String(component.weight) });
  const [form, setForm] = useState({ title: "", score: "", max_score: "", taken_on: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      await onUpdate({ name: draft.name.trim(), weight: Number(draft.weight) || 0 });
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { item } = await api<{ item: GradeItem }>("/api/grades/items", {
        body: { component_id: component.id, ...form, taken_on: form.taken_on || null },
      });
      onItemAdded(item);
      setForm({ title: "", score: "", max_score: form.max_score, taken_on: "" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {editing ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              className="input min-w-[8rem] flex-1 py-1.5"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              aria-label="Part name"
            />
            <div className="relative w-20">
              <input
                className="input py-1.5 pr-6 text-right"
                inputMode="decimal"
                value={draft.weight}
                onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))}
                aria-label="Weight percent"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
            <button className="btn-primary px-2.5 py-1.5" onClick={saveEdit} disabled={busy || !draft.name.trim()} aria-label="Save">
              <Check className="h-4 w-4" />
            </button>
            <button className="btn-ghost px-2.5 py-1.5" onClick={() => setEditing(false)} aria-label="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-400 transition", !expanded && "-rotate-90")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium text-slate-900">{component.name}</span>
                <span className="shrink-0 text-xs font-semibold text-tu-700">{Number(component.weight)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={clsx("h-full rounded-full", percent == null ? "" : percent >= 80 ? "bg-emerald-500" : percent >= 60 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${Math.min(100, percent ?? 0)}%` }}
                />
              </div>
            </div>
            <div className="w-28 shrink-0 text-right">
              {percent == null ? (
                <span className="text-xs text-slate-400">{items.length ? "" : "no scores yet"}</span>
              ) : (
                <>
                  <p className="text-sm font-semibold">{fmtPct(percent)}</p>
                  <p className="text-[11px] text-slate-400">
                    {Number((points ?? 0).toFixed(2))} / {Number(component.weight)} pts
                  </p>
                </>
              )}
            </div>
          </button>
        )}
        {!editing && (
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={() => {
                setDraft({ name: component.name, weight: String(component.weight) });
                setEditing(true);
              }}
              className="rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Edit part"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Delete part">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3 pl-10">
          {component.description && <p className="mb-2 text-xs text-slate-500">{component.description}</p>}
          {items.length > 0 && (
            <ul className="mb-3 space-y-1">
              {items.map((item) => (
                <li key={item.id} className="group flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.taken_on && <span className="shrink-0 text-xs text-slate-400">{formatDate(item.taken_on)}</span>}
                  <span className="w-20 shrink-0 text-right font-mono text-xs">
                    {Number(item.score)} / {Number(item.max_score)}
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs font-semibold">
                    {fmtPct((Number(item.score) / Number(item.max_score)) * 100, 0)}
                  </span>
                  <button
                    onClick={() => onItemDelete(item)}
                    className="shrink-0 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addItem} className="flex flex-wrap items-center gap-2">
            <input
              className="input min-w-[8rem] flex-1 py-1.5"
              placeholder={items.length ? `e.g. ${component.name} ${items.length + 1}` : `e.g. ${component.name}`}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              disabled={busy}
              aria-label="Result name"
            />
            <input
              className="input w-20 py-1.5 text-right"
              placeholder="Score"
              inputMode="decimal"
              value={form.score}
              onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
              disabled={busy}
              aria-label="Score"
            />
            <span className="text-sm text-slate-400">/</span>
            <input
              className="input w-20 py-1.5 text-right"
              placeholder="Out of"
              inputMode="decimal"
              value={form.max_score}
              onChange={(e) => setForm((f) => ({ ...f, max_score: e.target.value }))}
              disabled={busy}
              aria-label="Out of"
            />
            <input
              type="date"
              className="input w-36 py-1.5"
              value={form.taken_on}
              onChange={(e) => setForm((f) => ({ ...f, taken_on: e.target.value }))}
              disabled={busy}
              aria-label="Date"
            />
            <button type="submit" className="btn-primary px-3 py-1.5" disabled={busy || !form.title.trim() || form.score === "" || !form.max_score}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add score
            </button>
          </form>
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </li>
  );
}
