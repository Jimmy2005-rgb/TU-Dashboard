import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { UpdateComponentRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { GradeComponent } from "@/lib/types";

type Ctx = { params: { id: string } };

/** PATCH /api/grades/components/:id  { name?, weight? } */
export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await readJson(req, UpdateComponentRequest);
  if (parsed.error) return parsed.error;
  if (Object.keys(parsed.data).length === 0) return jsonError("Nothing to update.");

  const { data, error } = await getSupabaseAdmin()
    .from("grade_components")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("user_id", getOwnerId())
    .select("*")
    .maybeSingle<GradeComponent>();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Grade part not found.", 404);
  return NextResponse.json({ component: data });
}

/** DELETE /api/grades/components/:id — also removes its scores. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { error, count } = await getSupabaseAdmin()
    .from("grade_components")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", getOwnerId());
  if (error) return jsonError(error.message, 500);
  if (!count) return jsonError("Grade part not found.", 404);
  return NextResponse.json({ ok: true });
}
