import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { CreateSlotsRequest } from "@/lib/schemas";
import { ensureCourses, getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { ClassSlot } from "@/lib/types";

/** POST /api/schedule/slots — add weekly class times ({ replace: true } swaps the whole timetable). */
export async function POST(req: Request) {
  const parsed = await readJson(req, CreateSlotsRequest);
  if (parsed.error) return parsed.error;
  const userId = getOwnerId();

  const rows = [];
  for (const s of parsed.data.slots) {
    const code = normalizeCourseCode(s.course_code);
    if (!code) return jsonError(`"${s.course_code}" isn't a course code like AC201.`);
    rows.push({ user_id: userId, course_code: code, weekday: s.weekday, start_time: s.start_time, end_time: s.end_time, room: s.room || null, section: s.section || null });
  }

  try {
    const db = getSupabaseAdmin();
    await ensureCourses([...new Set(rows.map((r) => r.course_code))].map((course_code) => ({ course_code })));
    if (parsed.data.replace) {
      const { error } = await db.from("class_slots").delete().eq("user_id", userId);
      if (error) throw error;
    }
    const { data, error } = await db.from("class_slots").insert(rows).select("*");
    if (error) throw error;
    return NextResponse.json({ slots: (data ?? []) as ClassSlot[] }, { status: 201 });
  } catch (err) {
    return jsonError(`Saving failed: ${err instanceof Error ? err.message : "database error"}`, 500);
  }
}
