import type { GradeComponent, GradeItem } from "./types";

/**
 * Letter-grade cut-offs commonly used at Thammasat (percent). Individual
 * professors may curve or use different cut-offs, so treat as an estimate.
 */
export const LETTER_SCALE = [
  { letter: "A", min: 80 },
  { letter: "B+", min: 75 },
  { letter: "B", min: 70 },
  { letter: "C+", min: 65 },
  { letter: "C", min: 60 },
  { letter: "D+", min: 55 },
  { letter: "D", min: 50 },
  { letter: "F", min: 0 },
] as const;

export function letterFor(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) return "—";
  return LETTER_SCALE.find((g) => percent >= g.min)?.letter ?? "F";
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
