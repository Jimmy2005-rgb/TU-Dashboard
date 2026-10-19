import { NextResponse } from "next/server";
import { parseIncomingDate } from "@/lib/dates";
import { jsonError, readJson } from "@/lib/http";
import { UpdateAssignmentRequest } from "@/lib/schemas";
import { ensureCourses, getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Assignment } from "@/lib/types";

type Ctx = { params: { id: string } };

/**
 * PATCH /api/assignments/:id
 * Body: any of { status, title, course_code, source_platform, due_date, description, external_link }.
 * course_code/due_date/description/external_link accept null (or "") to clear.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await readJson(req, UpdateAssignmentRequest);
  if (parsed.error) return parsed.error;
  const input = parsed.data;
  const patch: Record<string, unknown> = {};

  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completed_at = input.status === "completed" ? new Date().toISOString() : null;
  }
  if (input.title !== undefined) patch.title = input.title;
  if (input.source_platform !== undefined) patch.source_platform = input.source_platform;
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.external_link !== undefined) patch.external_link = input.external_link || null;

  if (input.course_code !== undefined) {
    const code = normalizeCourseCode(input.course_code);
    if (input.course_code && !code) return jsonError("Course code must look like FN201.");
    if (code) await ensureCourses([{ course_code: code }]);
    patch.course_code = code;
  }
  if (input.due_date !== undefined) {
    const due = parseIncomingDate(input.due_date);
    if (input.due_date && !due) return jsonError("That due date isn't valid.");
    patch.due_date = due;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("assignments")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", getOwnerId())
    .select("*")
    .maybeSingle<Assignment>();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Assignment not found.", 404);
  return NextResponse.json({ assignment: data });
}

/** DELETE /api/assignments/:id */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { error, count } = await getSupabaseAdmin()
    .from("assignments")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", getOwnerId());

  if (error) return jsonError(error.message, 500);
  if (!count) return jsonError("Assignment not found.", 404);
  return NextResponse.json({ ok: true });
}
