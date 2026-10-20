import { addDays, bangkokDateKey } from "./schedule";
import type { QuestionReview } from "./types";

/**
 * Spaced review (Leitner boxes). A wrong answer puts the question in box 1, due
 * tomorrow. Each right answer moves it up a box and waits longer: 3, 7, 14 days.
 * Right in box 4 → mastered (no longer due). Due times are the start of the day
 * in Bangkok, so a question due "tomorrow" shows up in the morning.
 */
export const REVIEW_WAIT_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14 };
export const MASTERED_BOX = 5;

export type ReviewState = Pick<QuestionReview, "box" | "due_at" | "wrong_count" | "right_count">;

export function nextReview(prev: ReviewState | null, correct: boolean, now: number): ReviewState | null {
  const dueIn = (days: number) => `${addDays(bangkokDateKey(now), days)}T00:00:00+07:00`;
  if (!correct) {
    return { box: 1, due_at: new Date(dueIn(1)).toISOString(), wrong_count: (prev?.wrong_count ?? 0) + 1, right_count: prev?.right_count ?? 0 };
  }
  if (!prev) return null; // never missed: nothing to review
  const right_count = prev.right_count + 1;
  if (prev.due_at == null || prev.box + 1 >= MASTERED_BOX) return { box: MASTERED_BOX, due_at: null, wrong_count: prev.wrong_count, right_count };
  const box = prev.box + 1;
  return { box, due_at: new Date(dueIn(REVIEW_WAIT_DAYS[box])).toISOString(), wrong_count: prev.wrong_count, right_count };
}
