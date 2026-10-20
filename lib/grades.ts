import type { GradeComponent, GradeItem } from "./types";

/** Letter grades with the minimum percent for each, highest first. The last row is the fail grade (min 0). */
export type GradeScale = { letter: string; min: number }[];

/** Default cut-offs (A ≥ 85, B+ 80–84 … F ≤ 54). Editable per student and per course. */
export const DEFAULT_GRADE_SCALE: GradeScale = [
  { letter: "A", min: 85 },
  { letter: "B+", min: 80 },
  { letter: "B", min: 75 },
  { letter: "C+", min: 70 },
  { letter: "C", min: 65 },
  { letter: "D+", min: 60 },
  { letter: "D", min: 55 },
  { letter: "F", min: 0 },
];

/** The scale that applies: the course's own, else the student's default, else the built-in one. */
export function resolveScale(courseScale?: GradeScale | null, defaultScale?: GradeScale | null): GradeScale {
  return courseScale?.length ? courseScale : defaultScale?.length ? defaultScale : DEFAULT_GRADE_SCALE;
}

export function letterFor(percent: number | null, scale: GradeScale = DEFAULT_GRADE_SCALE): string {
  if (percent == null || Number.isNaN(percent)) return "—";
  return scale.find((g) => percent >= g.min)?.letter ?? scale[scale.length - 1]?.letter ?? "F";
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "≥ 85", "80 – 84", "≤ 54" — the way grade tables are printed in course outlines. */
export function scaleRanges(scale: GradeScale): { letter: string; range: string }[] {
  return scale.map((g, i) => {
    if (i === 0) return { letter: g.letter, range: `≥ ${num(g.min)}` };
    const below = scale[i - 1].min;
    const top = Number.isInteger(below) && Number.isInteger(g.min) ? num(below - 1) : `<${num(below)}`;
    if (i === scale.length - 1) return { letter: g.letter, range: `≤ ${top.replace("<", "< ")}` };
    return { letter: g.letter, range: `${num(g.min)} – ${top}` };
  });
}

/** Why a scale is invalid, or null if it's fine. */
export function scaleProblem(scale: GradeScale): string | null {
  if (scale.length < 2) return "Add at least two grades.";
  const letters = scale.map((g) => g.letter.trim().toUpperCase());
  if (letters.some((l) => !l)) return "Every row needs a letter.";
  if (new Set(letters).size !== letters.length) return "Each letter can only appear once.";
  for (let i = 0; i < scale.length; i++) {
    const m = scale[i].min;
    if (!Number.isFinite(m) || m < 0 || m > 100) return `${scale[i].letter}: the minimum must be between 0 and 100.`;
    if (i > 0 && m >= scale[i - 1].min) return `${scale[i].letter} must start below ${scale[i - 1].letter} (${scale[i - 1].min}).`;
  }
  if (scale[scale.length - 1].min !== 0) return "The last grade must start at 0.";
  return null;
}

/** Percent scored in one part: total points earned / total points possible. */
export function componentPercent(items: Pick<GradeItem, "score" | "max_score">[]): number | null {
  const max = items.reduce((n, i) => n + Number(i.max_score), 0);
  if (max <= 0) return null;
  return (items.reduce((n, i) => n + Number(i.score), 0) / max) * 100;
}

export interface ComponentResult {
  component: GradeComponent;
  items: GradeItem[];
  /** Percent scored so far in this part, or null if no results yet. */
  percent: number | null;
  /** Course points earned from this part (out of its weight). */
  points: number | null;
}

export interface GradeSummary {
  parts: ComponentResult[];
  /** Sum of all weights; should be 100. */
  totalWeight: number;
  /** Weight of parts that have at least one result. */
  gradedWeight: number;
  /** Course points earned so far (out of gradedWeight). */
  earnedPoints: number;
  /** Average across graded parts, weighted — the "grade so far". */
  currentPercent: number | null;
  remainingWeight: number;
  /** Lowest/highest final course percent still possible. */
  minPossible: number;
  maxPossible: number;
}

export function summarize(components: GradeComponent[], items: GradeItem[]): GradeSummary {
  const parts = [...components]
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((component) => {
      const own = items
        .filter((i) => i.component_id === component.id)
        .sort((a, b) => (a.taken_on ?? a.created_at).localeCompare(b.taken_on ?? b.created_at));
      const percent = componentPercent(own);
      return { component, items: own, percent, points: percent == null ? null : (Number(component.weight) * percent) / 100 };
    });

  const totalWeight = parts.reduce((n, p) => n + Number(p.component.weight), 0);
  const graded = parts.filter((p) => p.percent != null);
  const gradedWeight = graded.reduce((n, p) => n + Number(p.component.weight), 0);
  const earnedPoints = graded.reduce((n, p) => n + (p.points ?? 0), 0);
  const remainingWeight = Math.max(0, totalWeight - gradedWeight);
  const scale = totalWeight > 0 ? 100 / totalWeight : 1;

  return {
    parts,
    totalWeight,
    gradedWeight,
    earnedPoints,
    currentPercent: gradedWeight > 0 ? (earnedPoints / gradedWeight) * 100 : null,
    remainingWeight,
    minPossible: earnedPoints * scale,
    maxPossible: (earnedPoints + remainingWeight) * scale,
  };
}

/**
 * Average percent needed on all ungraded parts to finish at `target` percent.
 * Returns null when nothing is left to grade.
 */
export function neededOnRemaining(summary: GradeSummary, target: number): number | null {
  if (summary.remainingWeight <= 0 || summary.totalWeight <= 0) return null;
  const targetPoints = (target / 100) * summary.totalWeight;
  return ((targetPoints - summary.earnedPoints) / summary.remainingWeight) * 100;
}

export function fmtPct(n: number | null, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n.toFixed(digits))}%`;
}
