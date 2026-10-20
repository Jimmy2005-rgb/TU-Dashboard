import { getOwnerId, getSupabaseAdmin } from "./supabase";
import type { ClassSlot, StudySettings } from "./types";

export interface ScheduleData {
  slots: ClassSlot[];
  settings: StudySettings | null;
}

/** The student's weekly timetable and semester dates. Empty (not an error) before migration 005 is run. */
export async function loadSchedule(): Promise<ScheduleData> {
  try {
    const db = getSupabaseAdmin();
    const userId = getOwnerId();
    const [slots, settings] = await Promise.all([
      db.from("class_slots").select("*").eq("user_id", userId).order("weekday").order("start_time"),
      db.from("study_settings").select("*").eq("user_id", userId).maybeSingle<StudySettings>(),
    ]);
    return {
      slots: slots.error ? [] : ((slots.data ?? []) as ClassSlot[]),
      settings: settings.error ? null : (settings.data ?? null),
    };
  } catch {
    return { slots: [], settings: null };
  }
}
