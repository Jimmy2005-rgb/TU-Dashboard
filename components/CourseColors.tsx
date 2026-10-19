"use client";

import { createContext, useContext } from "react";

const CourseColorContext = createContext<Record<string, number>>({});

export function CourseColorProvider({ colors, children }: { colors: Record<string, number>; children: React.ReactNode }) {
  return <CourseColorContext.Provider value={colors}>{children}</CourseColorContext.Provider>;
}

/** CSS class (`course-1` … `course-7`) that sets --course for a course code. */
export function useCourseColorClass(code: string | null | undefined): string {
  const colors = useContext(CourseColorContext);
  return code && colors[code] ? `course-${colors[code]}` : "";
}

export function useCourseColors(): Record<string, number> {
  return useContext(CourseColorContext);
}
