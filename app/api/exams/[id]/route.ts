import { NextResponse } from "next/server";
import { parseIncomingDate } from "@/lib/dates";
import { jsonError, readJson } from "@/lib/http";
import { UpdateExamRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Exam } from "@/lib/types";

/** PATCH /api/exams/:id — change any field. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = await readJson(req, UpdateExamRequest);
  if (parsed.error) return parsed.error;
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.starts_at !== undefined) {
    patch.starts_at = parseIncomingDate(parsed.data.starts_at);
    if (!patch.starts_at) return jsonError("That exam date isn't valid.");
  }
  if (parsed.data.ends_at !== undefined) patch.ends_at = parseIncomingDate(parsed.data.ends_at);

  const { data, error } = await getSupabaseAdmin()
    .from("exams")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", getOwnerId())
    .select("*")
    .maybeSingle<Exam>();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Exam not found.", 404);
  return NextResponse.json({ exam: data });
}

/** DELETE /api/exams/:id */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await getSupabaseAdmin().from("exams").delete().eq("id", params.id).eq("user_id", getOwnerId());
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
