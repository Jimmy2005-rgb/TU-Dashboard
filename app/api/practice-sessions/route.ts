import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { PracticeSessionRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { PracticeSession } from "@/lib/types";

/**
 * POST /api/practice-sessions
 * Records a finished practice run with a short summary of weak topics.
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, PracticeSessionRequest);
  if (parsed.error) return parsed.error;
  const { score, total_questions, missed_tags, mode } = parsed.data;
  if (score > total_questions) return jsonError("Score cannot exceed total questions.");

  const pct = Math.round((score / total_questions) * 100);
  const tagCounts = new Map<string, number>();
  for (const t of missed_tags) if (t !== "ai-variation" && t !== "ai-answered") tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const weak = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  const summary = [
    `${score}/${total_questions} (${pct}%)${mode === "ai_variation" ? " on an AI variation quiz" : ""}.`,
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
  return NextResponse.json({ session: data }, { status: 201 });
}
