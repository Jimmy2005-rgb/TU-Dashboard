import { NextResponse } from "next/server";
import { parseAssignmentsWithClaude } from "@/lib/ai-tasks";
import { claudeErrorStatus, describeClaudeError } from "@/lib/claude";
import { jsonError, readJson } from "@/lib/http";
import { ParseAssignmentRequest } from "@/lib/schemas";
import { ensureCourses, getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Assignment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/parse-assignment
 * Body: { text, source_platform?, default_course_code? }
 * Claude turns a syllabus / notification / email into structured deadlines,
 * which are saved straight to the `assignments` table.
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, ParseAssignmentRequest);
  if (parsed.error) return parsed.error;
  const { text, source_platform, default_course_code } = parsed.data;

  let result;
  try {
    result = await parseAssignmentsWithClaude(text, default_course_code);
  } catch (err) {
    console.error("[parse-assignment] Claude error", err);
    return jsonError(describeClaudeError(err), claudeErrorStatus(err));
  }

  if (result.assignments.length === 0) {
    return NextResponse.json({ assignments: [], message: "No deadlines or tasks were found in that text." });
  }

  try {
    await ensureCourses([
      ...result.courses_detected,
      ...result.assignments.flatMap((a) => (a.course_code ? [{ course_code: a.course_code }] : [])),
    ]);

    const userId = getOwnerId();
    const { data, error } = await getSupabaseAdmin()
      .from("assignments")
      .insert(result.assignments.map((a) => ({ ...a, user_id: userId, source_platform })))
      .select("*");
    if (error) throw error;

    return NextResponse.json({ assignments: data as Assignment[] }, { status: 201 });
  } catch (err) {
    console.error("[parse-assignment] DB error", err);
    return jsonError(`Saving failed: ${err instanceof Error ? err.message : "database error"}`, 500);
  }
}
