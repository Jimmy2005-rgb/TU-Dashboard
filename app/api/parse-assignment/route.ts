import { NextResponse } from "next/server";
import { parseAssignmentsWithAI } from "@/lib/ai-tasks";
import { aiErrorStatus, describeAiError } from "@/lib/ai";
import { classCalendarForAi } from "@/lib/schedule";
import { loadSchedule } from "@/lib/schedule-data";
import { jsonError } from "@/lib/http";
import { ParseAssignmentRequest } from "@/lib/schemas";
import { ensureCourses, getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Assignment, Course } from "@/lib/types";
import { readAiRequest } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/parse-assignment
 * Body: JSON or multipart form with { text?, source_platform?, default_course_code?, files? }
 * (files: PDFs or photos, 4 MB total).
 * The AI turns a syllabus / notification / email into structured deadlines,
 * which are saved straight to the `assignments` table.
 */
export async function POST(req: Request) {
  const parsed = await readAiRequest(req, ParseAssignmentRequest);
  if (parsed.error) return parsed.error;
  const { text, source_platform, default_course_code } = parsed.data;
  if (text.length < 5 && parsed.files.length === 0) return jsonError("Paste some text or drop a file first.");

  // Give the AI the student's course list so it can match announcements by course name.
  const { data: knownCourses } = await getSupabaseAdmin().from("courses").select("course_code, name").order("course_code");

  let result;
  try {
    const { slots, settings } = await loadSchedule();
    const calendar = classCalendarForAi(slots, settings, Date.now());
    result = await parseAssignmentsWithAI(text, default_course_code, parsed.files, (knownCourses ?? []) as Course[], calendar);
  } catch (err) {
    console.error("[parse-assignment] AI error", err);
    return jsonError(describeAiError(err), aiErrorStatus(err));
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
