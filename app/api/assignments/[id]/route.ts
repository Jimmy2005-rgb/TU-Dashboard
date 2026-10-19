import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { UpdateAssignmentRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Assignment } from "@/lib/types";

type Ctx = { params: { id: string } };

/** PATCH /api/assignments/:id  { status: "pending" | "completed" } */
export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await readJson(req, UpdateAssignmentRequest);
  if (parsed.error) return parsed.error;
  const { status } = parsed.data;

  const { data, error } = await getSupabaseAdmin()
    .from("assignments")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
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
