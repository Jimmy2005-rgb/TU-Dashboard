import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { UpdateStudySettingsRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { StudySettings } from "@/lib/types";

/** PUT /api/schedule/settings — semester start/end and days without class. */
export async function PUT(req: Request) {
  const parsed = await readJson(req, UpdateStudySettingsRequest);
  if (parsed.error) return parsed.error;
  const noClass = parsed.data.no_class_days
    .map((p) => ({ ...p, end: p.end < p.start ? p.start : p.end }))
    .sort((a, b) => a.start.localeCompare(b.start));

  const { data, error } = await getSupabaseAdmin()
    .from("study_settings")
    .upsert(
      {
        user_id: getOwnerId(),
        semester_start: parsed.data.semester_start,
        semester_end: parsed.data.semester_end,
        no_class_days: noClass,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single<StudySettings>();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ settings: data });
}
