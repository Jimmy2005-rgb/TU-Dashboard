import { NextResponse } from "next/server";
import { FILES_BUCKET, isOwnedPath } from "@/lib/files";
import { jsonError, readJson } from "@/lib/http";
import { CreateMaterialRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { CourseMaterial } from "@/lib/types";

/**
 * POST /api/courses/:code/materials
 * Saves a link/note, or an uploaded file (file_path from the upload-url step).
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = normalizeCourseCode(params.code);
  if (!code) return jsonError("Invalid course code.");

  const parsed = await readJson(req, CreateMaterialRequest);
  if (parsed.error) return parsed.error;
  const m = parsed.data;
  const ownerId = getOwnerId();
  const db = getSupabaseAdmin();

  if (m.file_path) {
    if (!isOwnedPath(m.file_path, ownerId, code)) return jsonError("Invalid file path.", 400);
    // Make sure the upload actually landed before recording it.
    const folder = m.file_path.slice(0, m.file_path.lastIndexOf("/"));
    const name = m.file_path.slice(m.file_path.lastIndexOf("/") + 1);
    const { data: found } = await db.storage.from(FILES_BUCKET).list(folder, { search: name, limit: 1 });
    if (!found?.some((f) => f.name === name)) return jsonError("The upload didn't finish. Please try again.", 409);
  }

  const { data, error } = await db
    .from("course_materials")
    .insert({
      user_id: ownerId,
      course_code: code,
      title: m.title,
      url: m.url || null,
      notes: m.notes || null,
      kind: m.kind,
      file_path: m.file_path || null,
      file_name: m.file_name || null,
      file_size: m.file_size ?? null,
      mime_type: m.mime_type || null,
    })
    .select("*")
    .single<CourseMaterial>();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ material: data }, { status: 201 });
}
