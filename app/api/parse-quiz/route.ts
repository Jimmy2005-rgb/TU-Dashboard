import { NextResponse } from "next/server";
import { parseQuizWithAI } from "@/lib/ai-tasks";
import { aiErrorStatus, describeAiError } from "@/lib/ai";
import { jsonError, readJson } from "@/lib/http";
import { ParseQuizRequest } from "@/lib/schemas";
import { ensureCourses, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Course, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/parse-quiz
 * Body: { text, course_code }
 * The AI cleans scraped quiz text into questions, options, answers and worked
 * explanations, saved to `quiz_bank`.
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, ParseQuizRequest);
  if (parsed.error) return parsed.error;

  const courseCode = normalizeCourseCode(parsed.data.course_code);
  if (!courseCode) return jsonError("Course code must look like FN201.");

  const db = getSupabaseAdmin();
  try {
    await ensureCourses([{ course_code: courseCode }]);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Database error", 500);
  }
  const { data: course } = await db.from("courses").select("course_code, name").eq("course_code", courseCode).single<Pick<Course, "course_code" | "name">>();

  let questions;
  try {
    questions = await parseQuizWithAI(parsed.data.text, course ?? { course_code: courseCode, name: courseCode });
  } catch (err) {
    console.error("[parse-quiz] AI error", err);
    return jsonError(describeAiError(err), aiErrorStatus(err));
  }

  if (questions.length === 0) {
    return NextResponse.json({ questions: [], message: "No questions were found in that text." });
  }

  const { data, error } = await db
    .from("quiz_bank")
    .insert(questions.map((q) => ({ ...q, course_code: courseCode, source: "pasted" })))
    .select("*");
  if (error) {
    console.error("[parse-quiz] DB error", error);
    return jsonError(`Saving failed: ${error.message}`, 500);
  }

  return NextResponse.json({ questions: data as QuizQuestion[] }, { status: 201 });
}
