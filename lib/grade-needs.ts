import { letterFor, neededOnRemaining, summarize } from "./grades";
import { getOwnerId, getSupabaseAdmin } from "./supabase";
import type { Course, GradeComponent, GradeItem } from "./types";

/** What a course still needs: the average required on everything not yet graded to reach the target. */
export interface GradeNeed {
  /** Percent needed on the remaining parts, or null if nothing is graded yet / no grading set up. */
  needed: number | null;
  target: number;
  targetLetter: string;
  remainingWeight: number;
  currentPercent: number | null;
}

export async function loadGradeNeeds(courses: Pick<Course, "course_code" | "target_percent">[]): Promise<Record<string, GradeNeed>> {
  if (!courses.length) return {};
  const db = getSupabaseAdmin();
  const userId = getOwnerId();
  const codes = courses.map((c) => c.course_code);
  const { data: components } = await db.from("grade_components").select("*").eq("user_id", userId).in("course_code", codes);
  const ids = (components ?? []).map((c) => c.id as string);
  const { data: items } = ids.length ? await db.from("grade_items").select("*").in("component_id", ids) : { data: [] };

  const out: Record<string, GradeNeed> = {};
  for (const c of courses) {
    const own = ((components ?? []) as GradeComponent[]).filter((g) => g.course_code === c.course_code);
    if (!own.length) continue;
    const summary = summarize(own, (items ?? []) as GradeItem[]);
    const target = Number(c.target_percent ?? 80);
    out[c.course_code] = {
      needed: summary.gradedWeight > 0 ? neededOnRemaining(summary, target) : null,
      target,
      targetLetter: letterFor(target),
      remainingWeight: summary.remainingWeight,
      currentPercent: summary.currentPercent,
    };
  }
  return out;
}
