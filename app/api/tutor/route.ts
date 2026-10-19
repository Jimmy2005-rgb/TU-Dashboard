import { tutorSystemPrompt } from "@/lib/ai-tasks";
import { streamChat } from "@/lib/ai";
import { jsonError, readJson } from "@/lib/http";
import { TutorRequest } from "@/lib/schemas";
import { getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Course, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/tutor
 * Body: { course_code, messages: [{ role, content }] }
 * Streams a plain-text reply from a course-specific BBA tutor.
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, TutorRequest);
  if (parsed.error) return parsed.error;

  const { messages } = parsed.data;
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") {
    return jsonError("Conversation must start and end with a user message.");
  }

  const courseCode = normalizeCourseCode(parsed.data.course_code);
  if (!courseCode) return jsonError("Invalid course code.");

  const db = getSupabaseAdmin();
  const [{ data: course }, { data: questions }] = await Promise.all([
    db.from("courses").select("*").eq("course_code", courseCode).maybeSingle<Course>(),
    db
      .from("quiz_bank")
      .select("question_text, tags")
      .eq("course_code", courseCode)
      .order("created_at", { ascending: true })
      .limit(15),
  ]);
  if (!course) return jsonError(`Course ${courseCode} not found.`, 404);

  const stream = streamChat({
    system: tutorSystemPrompt(course, (questions ?? []) as Pick<QuizQuestion, "question_text" | "tags">[]),
    messages,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
