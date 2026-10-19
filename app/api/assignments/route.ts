import { NextResponse } from "next/server";
import { parseIncomingDate } from "@/lib/dates";
import { jsonError, readJson } from "@/lib/http";
import { CreateAssignmentRequest } from "@/lib/schemas";
import { ensureCourses, getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Assignment } from "@/lib/types";

/** POST /api/assignments — add an assignment by hand (no AI needed). */
export async function POST(req: Request) {
  const parsed = await readJson(req, CreateAssignmentRequest);
  if (parsed.error) return parsed.error;
  const { title, source_platform, description, external_link } = parsed.data;

  const courseCode = normalizeCourseCode(parsed.data.course_code);
  if (parsed.data.course_code && !courseCode) return jsonError("Course code must look like FN201.");

  const dueDate = parseIncomingDate(parsed.data.due_date);
  if (parsed.data.due_date && !dueDate) return jsonError("That due date isn't valid.");

  try {
    if (courseCode) await ensureCourses([{ course_code: courseCode }]);
    const { data, error } = await getSupabaseAdmin()
      .from("assignments")
      .insert({
        user_id: getOwnerId(),
        title,
        course_code: courseCode,
        source_platform,
        due_date: dueDate,
        description: description || null,
        external_link: external_link || null,
      })
      .select("*")
      .single<Assignment>();
    if (error) throw error;
    return NextResponse.json({ assignment: data }, { status: 201 });
  } catch (err) {
    return jsonError(`Saving failed: ${err instanceof Error ? err.message : "database error"}`, 500);
  }
}
