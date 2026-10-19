import { NextResponse } from "next/server";
import { generateVariationsWithAI } from "@/lib/ai-tasks";
import { aiErrorStatus, describeAiError } from "@/lib/ai";
import { jsonError, readJson } from "@/lib/http";
import { GenerateVariationRequest } from "@/lib/schemas";
import { getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Course, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/generate-variation
 * Body: { course_code, question_ids?, count?, save? }
 * The AI writes fresh numerical/scenario variations of saved questions.
 * With save=true (default) they are added to the bank tagged "ai-variation".
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, GenerateVariationRequest);
  if (parsed.error) return parsed.error;
  const { question_ids, count, save } = parsed.data;

  const courseCode = normalizeCourseCode(parsed.data.course_code);
  if (!courseCode) return jsonError("Course code must look like FN201.");

  const db = getSupabaseAdmin();
  const { data: course } = await db.from("courses").select("*").eq("course_code", courseCode).maybeSingle<Course>();
  if (!course) return jsonError(`Course ${courseCode} not found.`, 404);

  let query = db
    .from("quiz_bank")
    .select("question_text, question_type, options, correct_answer, tags")
    .eq("course_code", courseCode);
  query = question_ids?.length ? query.in("id", question_ids) : query.order("created_at", { ascending: false }).limit(40);
  const { data: pool, error: poolError } = await query;
  if (poolError) return jsonError(poolError.message, 500);
  if (!pool?.length) return jsonError("Save some questions for this course first, then generate variations.", 400);

  // Sample up to 10 source questions so prompts stay small and varied.
  const sources = [...pool].sort(() => Math.random() - 0.5).slice(0, 10) as QuizQuestion[];

  let generated;
  try {
    generated = await generateVariationsWithAI(course, sources, count);
  } catch (err) {
    console.error("[generate-variation] AI error", err);
    return jsonError(describeAiError(err), aiErrorStatus(err));
  }

  if (!save) {
    const now = new Date().toISOString();
    const transient = generated.map((q, i) => ({
      ...q,
      id: `tmp-${i}-${Date.now()}`,
      course_code: courseCode,
      source: "ai_variation" as const,
      created_at: now,
    }));
    return NextResponse.json({ questions: transient });
  }

  const { data, error } = await db
    .from("quiz_bank")
    .insert(generated.map((q) => ({ ...q, course_code: courseCode, source: "ai_variation" })))
    .select("*");
  if (error) return jsonError(`Saving failed: ${error.message}`, 500);

  return NextResponse.json({ questions: data as QuizQuestion[] }, { status: 201 });
}
