"use client";

import { createContext, useContext } from "react";
import type { ScheduleData } from "@/lib/schedule-data";

const ScheduleContext = createContext<ScheduleData>({ slots: [], settings: null });

/** Weekly timetable + semester dates, loaded once in the layout for every page. */
export function ScheduleProvider({ value, children }: { value: ScheduleData; children: React.ReactNode }) {
  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule(): ScheduleData {
  return useContext(ScheduleContext);
}
