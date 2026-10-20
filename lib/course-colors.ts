/**
 * Fixed colour per course. A course keeps its chosen slot (courses.color);
 * the rest are given the least-used slot in creation order, so colours stay
 * stable as you add courses. The code is always shown next to the colour.
 */
export const COURSE_COLOR_COUNT = 14;
export const COURSE_COLOR_NAMES = [
  "Blue", "Orange", "Aqua", "Yellow", "Pink", "Green", "Violet",
  "Brown", "Magenta", "Sky", "Lime", "Teal", "Grey", "Maroon",
];

export type CourseColorInput = { course_code: string; color: number | null; created_at: string };

export function assignCourseColors(courses: CourseColorInput[]): Record<string, number> {
  const sorted = [...courses].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.course_code.localeCompare(b.course_code));
  const map: Record<string, number> = {};
  const used = Array<number>(COURSE_COLOR_COUNT + 1).fill(0);
  for (const c of sorted) {
    if (c.color && c.color >= 1 && c.color <= COURSE_COLOR_COUNT) {
      map[c.course_code] = c.color;
      used[c.color]++;
    }
  }
  for (const c of sorted) {
    if (map[c.course_code]) continue;
    let best = 1;
    for (let slot = 2; slot <= COURSE_COLOR_COUNT; slot++) if (used[slot] < used[best]) best = slot;
    map[c.course_code] = best;
    used[best]++;
  }
  return map;
}
