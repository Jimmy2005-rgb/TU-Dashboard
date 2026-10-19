import { NextResponse } from "next/server";
import { FILES_BUCKET } from "@/lib/files";
import { jsonError, readJson } from "@/lib/http";
import { UpdateMaterialRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { CourseMaterial } from "@/lib/types";

type Ctx = { params: { id: string } };

/** PATCH /api/materials/:id  { title?, kind?, notes? } */
export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await readJson(req, UpdateMaterialRequest);
  if (parsed.error) return parsed.error;
  if (Object.keys(parsed.data).length === 0) return jsonError("Nothing to update.");
  const { data, error } = await getSupabaseAdmin()
    .from("course_materials")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("user_id", getOwnerId())
    .select("*")
    .maybeSingle<CourseMaterial>();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Material not found.", 404);
  return NextResponse.json({ material: data });
}

/** DELETE /api/materials/:id — also deletes the uploaded file, if any. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("course_materials")
    .delete()
    .eq("id", params.id)
    .eq("user_id", getOwnerId())
    .select("file_path")
    .maybeSingle<{ file_path: string | null }>();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Material not found.", 404);
  if (data.file_path) await db.storage.from(FILES_BUCKET).remove([data.file_path]);
  return NextResponse.json({ ok: true });
}
