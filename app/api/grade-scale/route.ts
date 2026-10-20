import { NextResponse } from "next/server";
import { scaleProblem } from "@/lib/grades";
import { jsonError, readJson } from "@/lib/http";
import { UpdateDefaultScaleRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";

/** PUT /api/grade-scale { grade_scale | null } — default letter-grade cut-offs for all courses. */
export async function PUT(req: Request) {
  const parsed = await readJson(req, UpdateDefaultScaleRequest);
  if (parsed.error) return parsed.error;
  const scale = parsed.data.grade_scale?.map((g) => ({ letter: g.letter.trim(), min: g.min })) ?? null;
  const problem = scale && scaleProblem(scale);
  if (problem) return jsonError(problem);

  const { error } = await getSupabaseAdmin()
    .from("study_settings")
    .upsert({ user_id: getOwnerId(), grade_scale: scale, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ grade_scale: scale });
}
