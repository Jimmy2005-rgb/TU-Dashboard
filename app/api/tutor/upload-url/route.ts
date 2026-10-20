import { NextResponse } from "next/server";
import { FILES_BUCKET, TUTOR_FOLDER, newFilePath } from "@/lib/files";
import { jsonError, readJson } from "@/lib/http";
import { TutorUploadUrlRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";

/**
 * POST /api/tutor/upload-url  { course_code, file_name, file_size }
 * One-time signed URL for a chat attachment; the browser uploads straight to storage.
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, TutorUploadUrlRequest);
  if (parsed.error) return parsed.error;
  const code = normalizeCourseCode(parsed.data.course_code);
  if (!code) return jsonError("Invalid course code.");

  const path = newFilePath(getOwnerId(), code, parsed.data.file_name, TUTOR_FOLDER);
  const { data, error } = await getSupabaseAdmin().storage.from(FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return jsonError(`Couldn't prepare the upload: ${error?.message ?? "unknown error"}.`, 500);
  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
}
