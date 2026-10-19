import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";

/** DELETE /api/quiz/:id — remove a question from the bank. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error, count } = await getSupabaseAdmin().from("quiz_bank").delete({ count: "exact" }).eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  if (!count) return jsonError("Question not found.", 404);
  return NextResponse.json({ ok: true });
}
