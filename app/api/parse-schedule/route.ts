import { NextResponse } from "next/server";
import { aiErrorStatus, describeAiError } from "@/lib/ai";
import { parseScheduleWithAI } from "@/lib/ai-tasks";
import { jsonError } from "@/lib/http";
import { ParseScheduleRequest } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Course } from "@/lib/types";
import { readAiRequest } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/parse-schedule
 * Multipart form or JSON: { text?, files? } — a timetable, exam schedule or academic calendar.
 * Returns a preview (classes, exams, semester dates); nothing is saved until the student confirms.
 */
export async function POST(req: Request) {
  const parsed = await readAiRequest(req, ParseScheduleRequest);
  if (parsed.error) return parsed.error;
  if (parsed.data.text.length < 5 && parsed.files.length === 0) return jsonError("Paste your timetable or drop a screenshot first.");

  const { data: courses } = await getSupabaseAdmin().from("courses").select("course_code, name").order("course_code");
  try {
    const schedule = await parseScheduleWithAI(parsed.data.text, parsed.files, (courses ?? []) as Course[]);
    return NextResponse.json({ schedule });
  } catch (err) {
    console.error("[parse-schedule] AI error", err);
    return jsonError(describeAiError(err), aiErrorStatus(err));
  }
}
