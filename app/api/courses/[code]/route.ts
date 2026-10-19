import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { UpdateCourseTargetRequest } from "@/lib/schemas";
import { getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
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
