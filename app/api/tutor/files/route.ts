import { NextResponse } from "next/server";
import { FILES_BUCKET, TUTOR_FOLDER } from "@/lib/files";
import { jsonError, readJson } from "@/lib/http";
import { TutorDeleteFilesRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";

/** DELETE /api/tutor/files { course_code, paths } — remove chat uploads (never course materials). */
export async function DELETE(req: Request) {
  const parsed = await readJson(req, TutorDeleteFilesRequest);
  if (parsed.error) return parsed.error;
  const code = normalizeCourseCode(parsed.data.course_code);
  if (!code) return jsonError("Invalid course code.");

  const prefix = `${getOwnerId()}/${code}/${TUTOR_FOLDER}/`;
  const paths = parsed.data.paths.filter((p) => p.startsWith(prefix) && !p.includes(".."));
  if (paths.length) {
    const { error } = await getSupabaseAdmin().storage.from(FILES_BUCKET).remove(paths);
    if (error) return jsonError(error.message, 500);
  }
  return NextResponse.json({ removed: paths.length });
}
