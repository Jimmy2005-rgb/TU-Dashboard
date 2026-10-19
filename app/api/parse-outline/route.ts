import { NextResponse } from "next/server";
import { aiErrorStatus, describeAiError } from "@/lib/ai";
import { parseOutlineWithAI } from "@/lib/ai-tasks";
import { jsonError } from "@/lib/http";
import { ParseOutlineRequest } from "@/lib/schemas";
import { getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Course } from "@/lib/types";
import { readAiRequest } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/parse-outline
 * Multipart form or JSON: { course_code, text?, files? }
 * The AI reads a course outline and returns its grading breakdown and dated
 * deadlines as a preview. Nothing is saved until the student confirms.
 */
export async function POST(req: Request) {
  const parsed = await readAiRequest(req, ParseOutlineRequest);
  if (parsed.error) return parsed.error;
  if (parsed.data.text.length < 10 && parsed.files.length === 0) {
    return jsonError("Paste the course outline or drop its file first.");
  }

  const code = normalizeCourseCode(parsed.data.course_code);
  if (!code) return jsonError("Invalid course code.");
  const { data: course } = await getSupabaseAdmin().from("courses").select("*").eq("course_code", code).maybeSingle<Course>();
  if (!course) return jsonError(`Course ${code} not found.`, 404);

  try {
    const outline = await parseOutlineWithAI(parsed.data.text, course, parsed.files);
    return NextResponse.json({ outline });
  } catch (err) {
    console.error("[parse-outline] AI error", err);
    return jsonError(describeAiError(err), aiErrorStatus(err));
  }
}
