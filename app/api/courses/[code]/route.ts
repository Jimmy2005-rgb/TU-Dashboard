import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { UpdateCourseTargetRequest } from "@/lib/schemas";
import { FILES_BUCKET } from "@/lib/files";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Course } from "@/lib/types";

/** PATCH /api/courses/:code  { target_percent } — the grade you're aiming for. */
export async function PATCH(req: Request, { params }: { params: { code: string } }) {
  const code = normalizeCourseCode(params.code);
  if (!code) return jsonError("Invalid course code.");
  const parsed = await readJson(req, UpdateCourseTargetRequest);
  if (parsed.error) return parsed.error;

  const { data, error } = await getSupabaseAdmin()
    .from("courses")
    .update({ target_percent: parsed.data.target_percent })
    .eq("course_code", code)
    .select("*")
    .maybeSingle<Course>();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Course not found.", 404);
  return NextResponse.json({ course: data });
}

/**
 * DELETE /api/courses/:code — remove a course and everything filed under it:
 * assignments, practice history, uploaded files, then the course row itself
 * (which cascades to questions, materials, grades, timetable, exams and reviews).
 */
export async function DELETE(_req: Request, { params }: { params: { code: string } }) {
  const code = normalizeCourseCode(params.code);
  if (!code) return jsonError("Invalid course code.");
  const db = getSupabaseAdmin();
  const userId = getOwnerId();

  const { data: files, error: filesError } = await db
    .from("course_materials")
    .select("file_path")
    .eq("course_code", code)
    .not("file_path", "is", null);
  if (filesError) return jsonError(filesError.message, 500);
  const paths = (files ?? []).map((f) => f.file_path as string);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from(FILES_BUCKET).remove(paths.slice(i, i + 100));
    if (error) return jsonError(`Couldn't delete the course files: ${error.message}`, 500);
  }

  // These two only lose their course link on delete, so remove them explicitly.
  for (const table of ["assignments", "practice_sessions"] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId).eq("course_code", code);
    if (error) return jsonError(error.message, 500);
  }

  const { data, error } = await db.from("courses").delete().eq("course_code", code).select("course_code");
  if (error) return jsonError(error.message, 500);
  if (!data?.length) return jsonError("Course not found.", 404);
  return NextResponse.json({ deleted: code });
}
