import { NextResponse } from "next/server";
import { parseIncomingDate } from "@/lib/dates";
import { jsonError, readJson } from "@/lib/http";
import { CreateExamRequest } from "@/lib/schemas";
import { ensureCourses, getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Exam } from "@/lib/types";

/** POST /api/exams — add an exam (midterm, final, quiz …). */
export async function POST(req: Request) {
  const parsed = await readJson(req, CreateExamRequest);
  if (parsed.error) return parsed.error;
  const e = parsed.data;

  const code = normalizeCourseCode(e.course_code);
  if (!code) return jsonError("Course code must look like AC201.");
  const startsAt = parseIncomingDate(e.starts_at);
  if (!startsAt) return jsonError("That exam date isn't valid.");
  const endsAt = parseIncomingDate(e.ends_at || null);

  try {
    await ensureCourses([{ course_code: code }]);
    const { data, error } = await getSupabaseAdmin()
      .from("exams")
      .insert({
        user_id: getOwnerId(),
        course_code: code,
        kind: e.kind,
        title: e.title,
        starts_at: startsAt,
        ends_at: endsAt,
        room: e.room || null,
        notes: e.notes || null,
        component_id: e.component_id || null,
      })
      .select("*")
      .single<Exam>();
    if (error) throw error;
    return NextResponse.json({ exam: data }, { status: 201 });
  } catch (err) {
    return jsonError(`Saving failed: ${err instanceof Error ? err.message : "database error"}`, 500);
  }
}
