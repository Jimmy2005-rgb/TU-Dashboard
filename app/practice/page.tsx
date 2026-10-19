import type { Metadata } from "next";
import PracticeClient from "@/components/practice/PracticeClient";
import SetupNotice from "@/components/SetupNotice";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Course, PracticeSession, QuizQuestion } from "@/lib/types";

export const metadata: Metadata = { title: "Quiz Vault" };
export const dynamic = "force-dynamic";

export default async function PracticePage({ searchParams }: { searchParams: { course?: string } }) {
  let db;
  try {
    db = getSupabaseAdmin();
  } catch (err) {
    return <SetupNotice message={(err as Error).message} />;
  }

  const [courses, questions, sessions] = await Promise.all([
    db.from("courses").select("*").order("course_code"),
    db.from("quiz_bank").select("*").order("created_at", { ascending: false }).limit(2000),
    db
      .from("practice_sessions")
      .select("*")
      .eq("user_id", getOwnerId())
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const error = courses.error ?? questions.error ?? sessions.error;
  if (error) return <SetupNotice message={`Database error: ${error.message}. Did you run supabase/schema.sql?`} />;

  return (
    <PracticeClient
      courses={(courses.data ?? []) as Course[]}
      initialQuestions={(questions.data ?? []) as QuizQuestion[]}
      initialSessions={(sessions.data ?? []) as PracticeSession[]}
      initialCourse={searchParams.course?.toUpperCase()}
    />
  );
}
