import type { Metadata } from "next";
import DashboardClient from "@/components/dashboard/DashboardClient";
import SetupNotice from "@/components/SetupNotice";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Assignment, Course } from "@/lib/types";

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

  return (
    <DashboardClient
      initialAssignments={[...(pending.data ?? []), ...(completed.data ?? [])] as Assignment[]}
      courses={(courses.data ?? []) as Course[]}
      serverNow={Date.now()}
    />
  );
}
