import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { CreateCourseRequest } from "@/lib/schemas";
import { getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Course } from "@/lib/types";

/** POST /api/courses — create or update a course by code. */
export async function POST(req: Request) {
  const parsed = await readJson(req, CreateCourseRequest);
  if (parsed.error) return parsed.error;

  const code = normalizeCourseCode(parsed.data.course_code);
  if (!code) return jsonError("Course code must look like FN201 (2-4 letters + 3 digits).");

  const { data, error } = await getSupabaseAdmin()
    .from("courses")
    .upsert(
      {
        course_code: code,
        name: parsed.data.name,
        professor: parsed.data.professor || null,
        semester: parsed.data.semester || null,
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      },
      { onConflict: "course_code" },
    )
    .select("*")
    .single<Course>();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ course: data }, { status: 201 });
}
