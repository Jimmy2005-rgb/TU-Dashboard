import { NextResponse } from "next/server";
import { aiErrorStatus, describeAiError } from "@/lib/ai";
import { parseQuizWithAI } from "@/lib/ai-tasks";
import { AI_READABLE_TYPES, FILES_BUCKET, MAX_AI_FILE_BYTES } from "@/lib/files";
import { jsonError } from "@/lib/http";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Course, CourseMaterial, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/materials/:id/quiz
 * Reads an uploaded exercise (PDF or photo) with the AI and saves its questions,
 * answers and worked explanations to the Quiz Vault for that course.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const db = getSupabaseAdmin();
  const { data: m } = await db
    .from("course_materials")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", getOwnerId())
    .maybeSingle<CourseMaterial>();
  if (!m?.file_path) return jsonError("File not found.", 404);
  if (!m.mime_type || !AI_READABLE_TYPES.includes(m.mime_type)) {
    return jsonError("The AI can read PDFs and photos. Save Word/PowerPoint files as PDF first.", 415);
  }
  if ((m.file_size ?? 0) > MAX_AI_FILE_BYTES) {
    return jsonError("That file is too big for the AI (15 MB max). Try a shorter PDF with just the exercises.", 413);
  }

  const { data: blob, error: dlError } = await db.storage.from(FILES_BUCKET).download(m.file_path);
  if (dlError || !blob) return jsonError(`Couldn't read the file: ${dlError?.message ?? "unknown error"}`, 500);

  const { data: course } = await db.from("courses").select("course_code, name").eq("course_code", m.course_code).maybeSingle<Course>();

  let questions;
  try {
    questions = await parseQuizWithAI("", course ?? { course_code: m.course_code, name: m.course_code }, [
      { name: m.file_name ?? "exercise", mimeType: m.mime_type, data: Buffer.from(await blob.arrayBuffer()).toString("base64") },
    ]);
  } catch (err) {
    console.error("[materials/quiz] AI error", err);
    return jsonError(describeAiError(err), aiErrorStatus(err));
  }
  if (!questions.length) return NextResponse.json({ questions: [], message: "No questions were found in that file." });

  const { data, error } = await db
    .from("quiz_bank")
    .insert(questions.map((q) => ({ ...q, course_code: m.course_code, source: "pasted" })))
    .select("*");
  if (error) return jsonError(`Saving failed: ${error.message}`, 500);
  return NextResponse.json({ questions: data as QuizQuestion[] }, { status: 201 });
}
