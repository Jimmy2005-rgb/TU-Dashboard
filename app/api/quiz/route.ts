import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { CreateQuestionRequest } from "@/lib/schemas";
import { ensureCourses, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { QuizQuestion } from "@/lib/types";

/** POST /api/quiz — add a question to the vault by hand (no AI needed). */
export async function POST(req: Request) {
  const parsed = await readJson(req, CreateQuestionRequest);
  if (parsed.error) return parsed.error;
  const q = parsed.data;

  const courseCode = normalizeCourseCode(q.course_code);
  if (!courseCode) return jsonError("Course code must look like FN201.");

  try {
    await ensureCourses([{ course_code: courseCode }]);
    const { data, error } = await getSupabaseAdmin()
      .from("quiz_bank")
      .insert({
        course_code: courseCode,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        tags: Array.from(new Set(q.tags.filter(Boolean))),
        source: "manual",
      })
      .select("*")
      .single<QuizQuestion>();
    if (error) throw error;
    return NextResponse.json({ question: data }, { status: 201 });
  } catch (err) {
    return jsonError(`Saving failed: ${err instanceof Error ? err.message : "database error"}`, 500);
  }
}
