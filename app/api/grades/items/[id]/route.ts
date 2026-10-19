import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";

/** DELETE /api/grades/items/:id */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error, count } = await getSupabaseAdmin()
    .from("grade_items")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", getOwnerId());
  if (error) return jsonError(error.message, 500);
  if (!count) return jsonError("Result not found.", 404);
  return NextResponse.json({ ok: true });
}
