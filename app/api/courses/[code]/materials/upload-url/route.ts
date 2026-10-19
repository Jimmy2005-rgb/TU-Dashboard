import { NextResponse } from "next/server";
import { FILES_BUCKET, newFilePath } from "@/lib/files";
import { jsonError, readJson } from "@/lib/http";
import { UploadUrlRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";

/**
 * POST /api/courses/:code/materials/upload-url  { file_name, file_size }
 * Returns a one-time signed URL the browser uploads the file to directly
 * (bypassing Vercel's 4.5 MB request limit). Valid for 2 hours.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = normalizeCourseCode(params.code);
  if (!code) return jsonError("Invalid course code.");
  const parsed = await readJson(req, UploadUrlRequest);
  if (parsed.error) return parsed.error;

  const path = newFilePath(getOwnerId(), code, parsed.data.file_name);
  const { data, error } = await getSupabaseAdmin().storage.from(FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    const hint = /bucket not found/i.test(error?.message ?? "") ? " Run supabase/migrations/003_course_files.sql first." : "";
    return jsonError(`Couldn't prepare the upload: ${error?.message ?? "unknown error"}.${hint}`, 500);
  }
  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl, token: data.token });
}
