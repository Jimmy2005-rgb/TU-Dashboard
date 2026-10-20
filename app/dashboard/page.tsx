import type { Metadata } from "next";
import DashboardClient from "@/components/dashboard/DashboardClient";
import SetupNotice from "@/components/SetupNotice";
import { aiProvider } from "@/lib/ai";
import { loadGradeNeeds } from "@/lib/grade-needs";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Assignment, Course, Exam } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let db;
  try {
    db = getSupabaseAdmin();
  } catch (err) {
    return <SetupNotice message={(err as Error).message} />;
  }

  const userId = getOwnerId();
  const completedSince = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  const [pending, completed, courses] = await Promise.all([
    db
      .from("assignments")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500),
    db
      .from("assignments")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", completedSince)
      .order("completed_at", { ascending: false })
      .limit(200),
    db.from("courses").select("*").order("course_code"),
  ]);

  const error = pending.error ?? completed.error ?? courses.error;
  if (error) return <SetupNotice message={`Database error: ${error.message}. Did you run supabase/schema.sql?`} />;

  // Timetable extras (migration 005). Missing tables just mean nothing to show yet.
  const soon = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  const [exams, reviews] = await Promise.all([
    db.from("exams").select("*").eq("user_id", userId).gte("starts_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString()).lte("starts_at", soon).order("starts_at"),
    db.from("question_reviews").select("question_id", { count: "exact", head: true }).eq("user_id", userId).lte("due_at", new Date().toISOString()),
  ]);
  const examList = (exams.error ? [] : (exams.data ?? [])) as Exam[];
  const courseList = (courses.data ?? []) as Course[];
  const needs = await loadGradeNeeds(courseList.filter((c) => examList.some((e) => e.course_code === c.course_code))).catch(() => ({}));

  return (
    <DashboardClient
      exams={examList}
      needs={needs}
      reviewDue={reviews.error ? 0 : (reviews.count ?? 0)}
      initialAssignments={[...(pending.data ?? []), ...(completed.data ?? [])] as Assignment[]}
      courses={(courses.data ?? []) as Course[]}
      serverNow={Date.now()}
      aiEnabled={aiProvider() !== null}
    />
  );
}
