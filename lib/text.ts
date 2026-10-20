/**
 * Drop a leading course code from a title when the course badge already shows it
 * ("AC201 Quizzes on Chapter 3" → "Quizzes on Chapter 3"). Keeps the title if nothing would be left.
 */
export function shortTitle(title: string, courseCode: string | null): string {
  if (!courseCode) return title;
  const re = new RegExp(`^\\s*${courseCode.replace(/[^A-Za-z0-9]/g, "")}\\b[\\s:·\\-–—|]*`, "i");
  const rest = title.replace(re, "");
  return rest.trim() ? rest : title;
}

/** "1 material", "3 materials". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
