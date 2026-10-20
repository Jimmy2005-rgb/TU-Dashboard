import { bangkokNow, extractStructured } from "./ai";
import type { AiFile } from "./ai-shared";
import { parseIncomingDate } from "./dates";
import {
  ParsedAssignmentsSchema,
  ParsedOutlineSchema,
  type ParsedOutline,
  ParsedQuizSchema,
  ParsedScheduleSchema,
  type NormalizedQuestion,
  type ParsedSchedule,
  type ParsedAssignments,
  type ParsedQuestion,
} from "./schemas";
import { normalizeCourseCode } from "./supabase";
import type { Course, QuizQuestion } from "./types";

// ─── Assignments ──────────────────────────────────────────────────────────

const MATH_FORMAT = `Maths formatting: write every formula, variable and calculation in LaTeX — inline as $...$ and on its own line as $$...$$ (e.g. $$NPV = \\sum_{t=1}^{n} \\frac{CF_t}{(1+r)^t} - C_0$$). Write money as "฿1,200" or "USD 100", never with a bare "$" sign, so it isn't mistaken for maths.`;

const ASSIGNMENT_SYSTEM = `You extract coursework deadlines for a Thammasat University BBA student.

Input is raw text and/or attached files (PDFs, photos or screenshots): a syllabus, a course outline, a course schedule, an LMS notification from Microsoft Teams or Google Classroom, an email, or a chat message. Return every gradable task or deadline you find: assignments, problem sets, quizzes, midterm/final exams, presentations, reports, case write-ups, readings that must be submitted.

Rules:
- One entry per distinct deliverable. Do not invent tasks that are not in the text.
- course_code: Thammasat style (2-4 letters + 3 digits, no space, e.g. FN201, AC201, MK201). Use the code in the text. If the text has no code but clearly names one of the student's courses (by course title, e.g. "Digital Technology"), use that course's code from the list supplied. Otherwise use the default course code supplied, else null. Don't guess from the topic alone.
- due_date: resolve relative dates ("next Friday", "Week 5") against the current date supplied. If a class timetable is supplied, use it: "before Class 11" or "by next class" = that class's start time, and an in-class quiz or exam = the class start time. If only a date is given, use 23:59 that day. Always output ISO 8601 with the +07:00 offset. If the text gives no usable deadline, return null — never guess.
- Thai dates and Buddhist-era years (e.g. 2569) must be converted to the Gregorian calendar (subtract 543).
- Keep descriptions concise: deliverables, format, weighting, submission channel.
- courses_detected: each course mentioned with its name and professor if stated.`;

export async function parseAssignmentsWithAI(
  text: string,
  defaultCourseCode?: string | null,
  files: AiFile[] = [],
  knownCourses: Pick<Course, "course_code" | "name">[] = [],
  classCalendar = "",
): Promise<ParsedAssignments> {
  const input = [
    `Current date: ${bangkokNow()}`,
    `Default course code: ${defaultCourseCode || "none"}`,
    knownCourses.length
      ? `Student's courses: ${knownCourses.map((c) => (c.name && c.name !== c.course_code ? `${c.course_code} = ${c.name}` : c.course_code)).join("; ")}`
      : "",
    files.length ? `Attached files: ${files.map((f) => f.name).join(", ")}` : "",
    classCalendar ? `\n<class_timetable>\n${classCalendar}\n</class_timetable>` : "",
    "",
    "<text>",
    text || "(no pasted text — read the attached files)",
    "</text>",
  ].join("\n");

  const result = await extractStructured({ system: ASSIGNMENT_SYSTEM, input, schema: ParsedAssignmentsSchema, files });

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

The input may be pasted text or attached files (PDFs, photos, screenshots) from Google Forms, Microsoft Forms, Moodle, exam papers or lecture slides: expect stray UI text ("Required", "1 point", "Clear selection"), broken line wraps, numbering, and answer letters. Ignore the noise.

For every question:
- question_text: the complete stem, with any data or table needed to solve it. Fix obvious formatting breaks but do not change meaning or numbers.
- question_type: "mcq" if it has answer choices, otherwise "open_ended".
- options: the choices as plain text without "A." / "(b)" prefixes. Empty for open_ended.
- correct_answer: for mcq, copy the correct option text exactly. If the text marks the answer (answer key, ✓, "Correct answer:", bold), use it. If no answer is given, solve the question yourself and add the tag "ai-answered".
- explanation: a step-by-step worked solution. For calculations show the formula, the substituted values and the result (e.g. NPV, WACC, ratios, journal entries, break-even). Keep it tight.
- ${MATH_FORMAT}
- tags: 2-4 lowercase topic tags.

Do not drop questions and do not invent questions that are not in the text.`;

const VARIATION_SYSTEM = `You write fresh practice questions for a Thammasat University BBA student, modelled on questions from their own course.

For each new question:
- Test the same concept as a source question but change the numbers, company names, and scenario so it cannot be answered from memory. Mix scenario types (Thai and global companies, different industries).
- For calculation questions, compute the answer carefully and double-check it; numbers must be internally consistent and realistic.
- MCQ: 4 options, exactly one correct, plausible distractors built from common mistakes (wrong sign, forgot to annualise, used the wrong rate). correct_answer must match one option exactly.
- Open-ended questions stay open-ended.
- explanation: a step-by-step worked solution.
- ${MATH_FORMAT}
- tags: reuse the source tags where relevant and add "ai-variation".`;

/** Reconcile the AI's answer with the options list, e.g. "B" → the 2nd option. */
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

export async function parseQuizWithAI(text: string, course: Pick<Course, "course_code" | "name">, files: AiFile[] = []) {
  const input = `Course: ${course.course_code} — ${course.name}\n\n<quiz_text>\n${text || "(no pasted text — read the attached files)"}\n</quiz_text>`;
  const result = await extractStructured({ system: QUIZ_SYSTEM, input, schema: ParsedQuizSchema, files });
  return result.questions.map(normalizeQuestion).filter((q) => q.question_text && q.correct_answer);
}

export async function generateVariationsWithAI(
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

// ─── Course outline ───────────────────────────────────────────────────────

const OUTLINE_SYSTEM = `You read a course outline / syllabus for a Thammasat University BBA student and extract how the course is graded.

Input is pasted text and/or attached files (PDFs, photos or screenshots of the outline).

components — the grading breakdown:
- One entry per graded part exactly as the outline lists it, e.g. "Midterm exam" 30, "Final exam" 35, "Quizzes" 10, "Group project" 15, "Class participation" 10.
- weight is the percent of the final grade as a number (30 for 30%). If the outline gives points instead of percents, convert to percents of the total.
- If a part is split (e.g. "Quizzes 10% (best 4 of 5)"), keep it as one part and put the detail in description.
- Weights normally add up to 100. Do not invent parts; if the outline has no grading breakdown, return an empty list.

deadlines — exams and due dates that have an exact date. Resolve dates against the current date supplied; convert Thai/Buddhist-era years (e.g. 2569) to Gregorian (subtract 543). Use 23:59 when only a date is given; ISO 8601 with +07:00. Skip items with no exact date.

course_name and professor: as written in the outline, or null.`;

export async function parseOutlineWithAI(
  text: string,
  course: Pick<Course, "course_code" | "name">,
  files: AiFile[] = [],
): Promise<ParsedOutline> {
  const input = [
    `Current date: ${bangkokNow()}`,
    `Course: ${course.course_code} — ${course.name}`,
    files.length ? `Attached files: ${files.map((f) => f.name).join(", ")}` : "",
    "",
    "<outline>",
    text || "(no pasted text — read the attached files)",
    "</outline>",
  ].join("\n");

  const result = await extractStructured({ system: OUTLINE_SYSTEM, input, schema: ParsedOutlineSchema, files });
  return {
    course_name: result.course_name?.trim() || null,
    professor: result.professor?.trim() || null,
    components: result.components
      .map((c) => ({
        name: c.name.trim().slice(0, 200),
        weight: Math.round(Math.min(100, Math.max(0, Number(c.weight) || 0)) * 100) / 100,
        description: c.description?.trim() || null,
      }))
      .filter((c) => c.name),
    deadlines: result.deadlines
      .map((d) => ({ title: d.title.trim().slice(0, 500), due_date: parseIncomingDate(d.due_date), description: d.description?.trim() || null }))
      .filter((d) => d.title && d.due_date),
  };
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
- The student may attach photos (homework, slides, whiteboard), PDFs, documents or voice notes. Read photos carefully and restate the problem before solving it. For a voice note, answer what they asked and reply in the language they spoke. If something in an attachment is unreadable, say which part.
- Use Markdown with short sections. Be concise.
- ${MATH_FORMAT}
${topics.length ? `\nTopics the student has been practising: ${topics.join(", ")}.` : ""}
${samples ? `\nExamples from the student's saved question bank for this course (use them to match the course's level and style):\n${samples}` : ""}`;
}

// ─── Timetable & exam schedule ────────────────────────────────────────────

const SCHEDULE_SYSTEM = `You read a Thammasat University BBA student's class timetable, exam schedule or academic calendar (pasted text, a PDF, or a screenshot from reg.tu.ac.th or a course outline) and turn it into structured data.

Rules:
- classes: one entry per course per weekday it meets. weekday: 1 = Monday … 7 = Sunday. Thai day names: จันทร์ = 1, อังคาร = 2, พุธ = 3, พฤหัสบดี = 4, ศุกร์ = 5, เสาร์ = 6, อาทิตย์ = 7; abbreviations like "MO", "TU", "WE", "TH", "FR", "SA", "SU" too. Times in 24-hour HH:MM (Bangkok).
- course_code: 2-4 letters + 3 digits, no space (e.g. "AC 201" → "AC201"). Use the student's course list to match names to codes.
- exams: midterm and final exams (and any dated quizzes/presentations) with date and time, ISO 8601 with +07:00. Thai dates and Buddhist-era years (e.g. 2569) must be converted to the Gregorian calendar (subtract 543). If only a date is given with no time, use 09:00.
- semester_start / semester_end / no_class_days only when the text states them (e.g. an academic calendar). Never invent dates.
- Return empty arrays for anything not present.`;

export async function parseScheduleWithAI(
  text: string,
  files: AiFile[] = [],
  knownCourses: Pick<Course, "course_code" | "name">[] = [],
): Promise<ParsedSchedule> {
  const input = [
    `Current date: ${bangkokNow()}`,
    knownCourses.length ? `Student's courses: ${knownCourses.map((c) => `${c.course_code} = ${c.name}`).join("; ")}` : "",
    files.length ? `Attached files: ${files.map((f) => f.name).join(", ")}` : "",
    "",
    "<text>",
    text || "(no pasted text — read the attached files)",
    "</text>",
  ].join("\n");

  const result = await extractStructured({ system: SCHEDULE_SYSTEM, input, schema: ParsedScheduleSchema, files });
  const time = (t: string) => {
    const m = /^(\d{1,2})[:.](\d{2})/.exec(t.trim());
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  };
  const day = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? d.trim() : null);
  const kinds = ["midterm", "final", "quiz", "presentation", "other"];

  return {
    classes: result.classes
      .map((c) => ({
        ...c,
        course_code: normalizeCourseCode(c.course_code) ?? "",
        weekday: Math.round(Number(c.weekday)),
        start_time: time(c.start_time),
        end_time: time(c.end_time),
        room: c.room?.trim() || null,
        section: c.section?.trim() || null,
      }))
      .filter((c) => c.course_code && c.weekday >= 1 && c.weekday <= 7 && c.start_time && c.end_time > c.start_time),
    exams: result.exams
      .map((e) => ({
        ...e,
        course_code: normalizeCourseCode(e.course_code) ?? "",
        kind: kinds.includes(e.kind.trim().toLowerCase()) ? e.kind.trim().toLowerCase() : "other",
        title: e.title.trim().slice(0, 200),
        starts_at: parseIncomingDate(e.starts_at) ?? "",
        ends_at: parseIncomingDate(e.ends_at),
        room: e.room?.trim() || null,
      }))
      .filter((e) => e.course_code && e.starts_at && e.title),
    semester_start: day(result.semester_start),
    semester_end: day(result.semester_end),
    no_class_days: result.no_class_days
      .map((p) => ({ start: day(p.start) ?? "", end: day(p.end) ?? day(p.start) ?? "", label: p.label.trim().slice(0, 100) }))
      .filter((p) => p.start && p.end >= p.start),
  };
}
