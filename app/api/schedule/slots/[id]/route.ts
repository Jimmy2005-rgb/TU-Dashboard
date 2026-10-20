import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";

/** DELETE /api/schedule/slots/:id */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await getSupabaseAdmin().from("class_slots").delete().eq("id", params.id).eq("user_id", getOwnerId());
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
