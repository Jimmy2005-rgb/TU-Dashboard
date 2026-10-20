import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { PracticeSessionRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import { nextReview } from "@/lib/review";
import type { PracticeSession, QuestionReview } from "@/lib/types";

/**
 * POST /api/practice-sessions
 * Records a finished practice run with a short summary of weak topics.
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, PracticeSessionRequest);
  if (parsed.error) return parsed.error;
  const { score, total_questions, missed_tags, mode, results } = parsed.data;
  if (score > total_questions) return jsonError("Score cannot exceed total questions.");

  const pct = Math.round((score / total_questions) * 100);
  const tagCounts = new Map<string, number>();
  for (const t of missed_tags) if (t !== "ai-variation" && t !== "ai-answered") tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const weak = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  const summary = [
    `${score}/${total_questions} (${pct}%)${mode === "ai_variation" ? " on an AI variation quiz" : mode === "review" ? " on a mistakes review" : ""}.`,
    weak.length ? `Review: ${weak.join(", ")}.` : pct === 100 ? "Perfect score." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { data, error } = await getSupabaseAdmin()
    .from("practice_sessions")
    .insert({
      user_id: getOwnerId(),
      course_code: normalizeCourseCode(parsed.data.course_code),
      score,
      total_questions,
      summary,
    })
    .select("*")
    .single<PracticeSession>();

  if (error) return jsonError(error.message, 500);

  // Schedule spaced reviews. A failure here shouldn't lose the saved score.
  let reviews: QuestionReview[] = [];
  try {
    reviews = await recordReviews(results);
  } catch (err) {
    console.error("[practice-sessions] review update failed", err);
  }
  return NextResponse.json({ session: data, reviews }, { status: 201 });
}

/** Update the spaced-review state of each answered question; returns the changed rows. */
async function recordReviews(results: { question_id: string; correct: boolean }[]): Promise<QuestionReview[]> {
  if (!results.length) return [];
  const db = getSupabaseAdmin();
  const userId = getOwnerId();
  const latest = new Map(results.map((r) => [r.question_id, r.correct]));
  const ids = [...latest.keys()];

  const [questions, existing] = await Promise.all([
    db.from("quiz_bank").select("id, course_code").in("id", ids),
    db.from("question_reviews").select("*").eq("user_id", userId).in("question_id", ids),
  ]);
  if (questions.error) throw questions.error;
  if (existing.error) throw existing.error;
  const prevById = new Map(((existing.data ?? []) as QuestionReview[]).map((r) => [r.question_id, r]));

  const now = Date.now();
  const rows = [];
  for (const q of questions.data ?? []) {
    const next = nextReview(prevById.get(q.id) ?? null, latest.get(q.id) ?? false, now);
    if (next) rows.push({ question_id: q.id, user_id: userId, course_code: q.course_code, ...next, last_answered_at: new Date(now).toISOString() });
  }
  if (!rows.length) return [];
  const { data, error } = await db.from("question_reviews").upsert(rows, { onConflict: "question_id" }).select("*");
  if (error) throw error;
  return (data ?? []) as QuestionReview[];
}
