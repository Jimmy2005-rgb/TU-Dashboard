import type { Metadata } from "next";
import ScheduleClient from "@/components/schedule/ScheduleClient";
import SetupNotice from "@/components/SetupNotice";
import { aiProvider } from "@/lib/ai";
import { loadGradeNeeds } from "@/lib/grade-needs";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { ClassSlot, Course, Exam, GradeComponent, StudySettings } from "@/lib/types";

export const metadata: Metadata = { title: "Timetable" };
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  let db;
  try {
    db = getSupabaseAdmin();
  } catch (err) {
    return <SetupNotice message={(err as Error).message} />;
  }
  const userId = getOwnerId();

  const [courses, slots, settings, exams, components] = await Promise.all([
    db.from("courses").select("*").order("course_code"),
    db.from("class_slots").select("*").eq("user_id", userId).order("weekday").order("start_time"),
    db.from("study_settings").select("*").eq("user_id", userId).maybeSingle<StudySettings>(),
    db.from("exams").select("*").eq("user_id", userId).order("starts_at"),
    db.from("grade_components").select("*").eq("user_id", userId).order("sort_order"),
  ]);
  const error = courses.error ?? slots.error ?? settings.error ?? exams.error ?? components.error;
  if (error) {
    return <SetupNotice message={`Database error: ${error.message}. Run supabase/migrations/005_schedule_exams_reviews.sql in the Supabase SQL editor.`} />;
  }

  const courseList = (courses.data ?? []) as Course[];
  const examList = (exams.data ?? []) as Exam[];
  const needs = await loadGradeNeeds(courseList.filter((c) => examList.some((e) => e.course_code === c.course_code)));

  return (
    <ScheduleClient
      courses={courseList}
      slots={(slots.data ?? []) as ClassSlot[]}
      settings={settings.data ?? null}
      exams={examList}
      components={(components.data ?? []) as GradeComponent[]}
      needs={needs}
      serverNow={Date.now()}
      aiEnabled={aiProvider() !== null}
    />
  );
}
