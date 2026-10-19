import { bangkokNow, extractStructured } from "./claude";
import { parseIncomingDate } from "./dates";
import {
  ParsedAssignmentsSchema,
  ParsedQuizSchema,
  type NormalizedQuestion,
  type ParsedAssignments,
  type ParsedQuestion,
} from "./schemas";
import { normalizeCourseCode } from "./supabase";
import type { Course, QuizQuestion } from "./types";

// ─── Assignments ──────────────────────────────────────────────────────────

const ASSIGNMENT_SYSTEM = `You extract coursework deadlines for a Thammasat University BBA student.

Input is raw text: a syllabus, a course schedule, an LMS notification from Microsoft Teams or Google Classroom, an email, or a chat message. Return every gradable task or deadline you find: assignments, problem sets, quizzes, midterm/final exams, presentations, reports, case write-ups, readings that must be submitted.

Rules:
- One entry per distinct deliverable. Do not invent tasks that are not in the text.
- course_code: Thammasat style (2-4 letters + 3 digits, no space, e.g. FN201, AC201, MK201). Use the code in the text; if none is given use the default course code supplied, otherwise null.
- due_date: resolve relative dates ("next Friday", "Week 5") against the current date supplied. If only a date is given, use 23:59 that day. Always output ISO 8601 with the +07:00 offset. If the text gives no usable deadline, return null — never guess.
- Thai dates and Buddhist-era years (e.g. 2569) must be converted to the Gregorian calendar (subtract 543).
- Keep descriptions concise: deliverables, format, weighting, submission channel.
- courses_detected: each course mentioned with its name and professor if stated.`;

export async function parseAssignmentsWithClaude(
  text: string,
  defaultCourseCode?: string | null,
): Promise<ParsedAssignments> {
  const input = [
    `Current date: ${bangkokNow()}`,
    `Default course code: ${defaultCourseCode || "none"}`,
    "",
    "<text>",
    text,
    "</text>",
  ].join("\n");

  const result = await extractStructured({ system: ASSIGNMENT_SYSTEM, input, schema: ParsedAssignmentsSchema });

  return {
    courses_detected: result.courses_detected
      .map((c) => ({ ...c, course_code: normalizeCourseCode(c.course_code) ?? "" }))
      .filter((c) => c.course_code),
    assignments: result.assignments.map((a) => ({
      title: a.title.trim().slice(0, 500),
      course_code: normalizeCourseCode(a.course_code) ?? normalizeCourseCode(defaultCourseCode),
      description: a.description?.trim() || null,
      due_date: parseIncomingDate(a.due_date),
      external_link: a.external_link && /^https?:\/\//i.test(a.external_link) ? a.external_link : null,
    })),
  };
}

// ─── Quizzes ──────────────────────────────────────────────────────────────

const QUIZ_SYSTEM = `You turn messy pasted quiz text into a clean question bank for a Thammasat University BBA student.

The input may be scraped from Google Forms, Microsoft Forms, Moodle, PDFs, or lecture slides: expect stray UI text ("Required", "1 point", "Clear selection"), broken line wraps, numbering, and answer letters. Ignore the noise.

For every question:
- question_text: the complete stem, with any data or table needed to solve it. Fix obvious formatting breaks but do not change meaning or numbers.
- question_type: "mcq" if it has answer choices, otherwise "open_ended".
- options: the choices as plain text without "A." / "(b)" prefixes. Empty for open_ended.
- correct_answer: for mcq, copy the correct option text exactly. If the text marks the answer (answer key, ✓, "Correct answer:", bold), use it. If no answer is given, solve the question yourself and add the tag "ai-answered".
- explanation: a step-by-step worked solution. For calculations show the formula, the substituted values and the result (e.g. NPV, WACC, ratios, journal entries, break-even). Keep it tight.
- tags: 2-4 lowercase topic tags.

Do not drop questions and do not invent questions that are not in the text.`;

const VARIATION_SYSTEM = `You write fresh practice questions for a Thammasat University BBA student, modelled on questions from their own course.

For each new question:
- Test the same concept as a source question but change the numbers, company names, and scenario so it cannot be answered from memory. Mix scenario types (Thai and global companies, different industries).
- For calculation questions, compute the answer carefully and double-check it; numbers must be internally consistent and realistic.
- MCQ: 4 options, exactly one correct, plausible distractors built from common mistakes (wrong sign, forgot to annualise, used the wrong rate). correct_answer must match one option exactly.
- Open-ended questions stay open-ended.
- explanation: a step-by-step worked solution.
- tags: reuse the source tags where relevant and add "ai-variation".`;

/** Reconcile Claude's answer with the options list, e.g. "B" → the 2nd option. */
export function normalizeQuestion(q: ParsedQuestion): NormalizedQuestion {
  const declaredOpen = /open/i.test(q.question_type);
  const options = declaredOpen ? [] : q.options.map((o) => o.trim()).filter(Boolean);
  let correct = q.correct_answer.trim();

  if (options.length > 0 && !options.includes(correct)) {
    const lower = correct.toLowerCase();
    const letter = /^\(?([a-h])[).:]?$/i.exec(correct)?.[1];
    const byLetter = letter ? options[letter.toLowerCase().charCodeAt(0) - 97] : undefined;
    const byText = options.find((o) => o.toLowerCase() === lower) ?? options.find((o) => o.toLowerCase().includes(lower));
    correct = byLetter ?? byText ?? correct;
  }

  return {
    question_text: q.question_text.trim(),
    question_type: options.length >= 2 ? "mcq" : "open_ended",
    options: options.length >= 2 ? options : [],
    correct_answer: correct,
    explanation: q.explanation.trim(),
    tags: Array.from(new Set(q.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 6),
  };
}

export async function parseQuizWithClaude(text: string, course: Pick<Course, "course_code" | "name">) {
  const input = `Course: ${course.course_code} — ${course.name}\n\n<quiz_text>\n${text}\n</quiz_text>`;
  const result = await extractStructured({ system: QUIZ_SYSTEM, input, schema: ParsedQuizSchema });
  return result.questions.map(normalizeQuestion).filter((q) => q.question_text && q.correct_answer);
}

export async function generateVariationsWithClaude(
  course: Pick<Course, "course_code" | "name">,
  sources: Pick<QuizQuestion, "question_text" | "question_type" | "options" | "correct_answer" | "tags">[],
  count: number,
) {
  const sourceText = sources
    .map((q, i) => {
      const opts = q.options.length ? `\nOptions: ${q.options.join(" | ")}` : "";
      return `${i + 1}. [${q.question_type}] ${q.question_text}${opts}\nAnswer: ${q.correct_answer}\nTags: ${q.tags.join(", ")}`;
    })
    .join("\n\n");

  const input = `Course: ${course.course_code} — ${course.name}\nWrite exactly ${count} new questions.\n\n<source_questions>\n${sourceText}\n</source_questions>`;

  const result = await extractStructured({
    system: VARIATION_SYSTEM,
    input,
    schema: ParsedQuizSchema,
    effort: "high", // numerical correctness matters here
  });
  return result.questions
    .map(normalizeQuestion)
    .map((q) => ({ ...q, tags: Array.from(new Set([...q.tags, "ai-variation"])) }))
    .slice(0, count);
}

// ─── Tutor ────────────────────────────────────────────────────────────────

export function tutorSystemPrompt(
  course: Pick<Course, "course_code" | "name" | "professor" | "semester">,
  sampleQuestions: Pick<QuizQuestion, "question_text" | "tags">[],
): string {
  const topics = Array.from(new Set(sampleQuestions.flatMap((q) => q.tags))).slice(0, 30);
  const samples = sampleQuestions
    .slice(0, 15)
    .map((q, i) => `${i + 1}. ${q.question_text.slice(0, 400)}`)
    .join("\n");

  return `You are a patient, rigorous BBA tutor for ${course.course_code} — ${course.name} at Thammasat Business School, Thammasat University${course.professor ? ` (taught by ${course.professor})` : ""}${course.semester ? `, semester ${course.semester}` : ""}.

How to tutor:
- Teach the way a strong TA would before a midterm: explain the concept, then work an example step by step, then check understanding with a short follow-up question when it helps.
- For calculations (finance, accounting, statistics, economics) show the formula, substitute the numbers, and state the answer with units. Point out the common mistakes.
- Use international standards students see in class (IFRS/TFRS for accounting, standard corporate-finance notation). Use Thai baht (฿) examples where natural.
- If the student pastes a graded assignment question, guide them to the answer with hints first; give the full solution when they ask for it.
- If the student writes in Thai, answer in Thai (keep technical terms in English in parentheses).
- Use Markdown with short sections. Be concise.
${topics.length ? `\nTopics the student has been practising: ${topics.join(", ")}.` : ""}
${samples ? `\nExamples from the student's saved question bank for this course (use them to match the course's level and style):\n${samples}` : ""}`;
}
