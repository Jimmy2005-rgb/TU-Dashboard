import { NextResponse } from "next/server";
import { FILES_BUCKET } from "@/lib/files";
import { jsonError } from "@/lib/http";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/materials/:id/file[?download=1]
 * Redirects to a short-lived signed URL for the uploaded file, so files stay
 * private but open normally in the browser (or download with ?download=1).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const db = getSupabaseAdmin();
  const { data: m } = await db
    .from("course_materials")
    .select("file_path, file_name")
    .eq("id", params.id)
    .eq("user_id", getOwnerId())
    .maybeSingle<{ file_path: string | null; file_name: string | null }>();
  if (!m?.file_path) return jsonError("File not found.", 404);

  const download = new URL(req.url).searchParams.get("download") === "1";
  const { data, error } = await db.storage
    .from(FILES_BUCKET)
    .createSignedUrl(m.file_path, 300, download ? { download: m.file_name ?? true } : undefined);
  if (error || !data) return jsonError(`Couldn't open the file: ${error?.message ?? "unknown error"}`, 500);
  return NextResponse.redirect(data.signedUrl, 302);
}
