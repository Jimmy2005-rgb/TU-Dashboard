import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CourseDetailClient from "@/components/courses/CourseDetailClient";
import SetupNotice from "@/components/SetupNotice";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Assignment, Course, CourseMaterial, PracticeSession, QuizQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  return { title: params.code.toUpperCase() };
}

export default async function CoursePage({ params }: { params: { code: string } }) {
  const code = normalizeCourseCode(params.code);
  if (!code) notFound();

  let db;
  try {
    db = getSupabaseAdmin();
  } catch (err) {
    return <SetupNotice message={(err as Error).message} />;
  }
  const userId = getOwnerId();

  const [course, assignments, materials, questions, sessions] = await Promise.all([
    db.from("courses").select("*").eq("course_code", code).maybeSingle<Course>(),
    db
      .from("assignments")
      .select("*")
      .eq("user_id", userId)
      .eq("course_code", code)
      .order("due_date", { ascending: true, nullsFirst: false }),
    db
      .from("course_materials")
      .select("*")
      .eq("user_id", userId)
      .eq("course_code", code)
      .order("created_at", { ascending: false }),
    db.from("quiz_bank").select("*").eq("course_code", code).order("created_at", { ascending: false }),
    db
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("course_code", code)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const error = course.error ?? assignments.error ?? materials.error ?? questions.error ?? sessions.error;
  if (error) return <SetupNotice message={`Database error: ${error.message}`} />;
  if (!course.data) notFound();

  return (
    <CourseDetailClient
      course={course.data}
      assignments={(assignments.data ?? []) as Assignment[]}
      initialMaterials={(materials.data ?? []) as CourseMaterial[]}
      questions={(questions.data ?? []) as QuizQuestion[]}
      sessions={(sessions.data ?? []) as PracticeSession[]}
    />
  );
}
