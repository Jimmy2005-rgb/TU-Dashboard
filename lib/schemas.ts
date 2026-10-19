import * as z from "zod";

// ─── AI output schemas (structured outputs) ───────────────────────────
// Keep these simple: every field required, `nullable()` instead of optional,
// no length/range constraints — the API enforces the JSON shape for us.

export const ParsedAssignmentsSchema = z.object({
  assignments: z.array(
    z.object({
      title: z.string().describe("Short, specific task title, e.g. 'FN201 Problem Set 3: Time Value of Money'"),
      course_code: z
        .string()
        .nullable()
        .describe("Course code like FN201 or AC201 (letters + 3 digits, no space). null if unknown."),
      description: z.string().nullable().describe("Key requirements, deliverables, weighting. null if none."),
      due_date: z
        .string()
        .nullable()
        .describe("ISO 8601 with +07:00 offset, e.g. 2026-11-03T23:59:00+07:00. null if no deadline is stated."),
      external_link: z.string().nullable().describe("A URL from the text that belongs to this task, else null."),
    }),
  ),
  courses_detected: z.array(
    z.object({
      course_code: z.string(),
      name: z.string().nullable(),
      professor: z.string().nullable(),
    }),
  ),
});
export type ParsedAssignments = z.infer<typeof ParsedAssignmentsSchema>;

export const ParsedQuizSchema = z.object({
  questions: z.array(
    z.object({
      question_text: z.string().describe("Full question stem, including any data/table needed to answer it."),
      question_type: z.string().describe('"mcq" if the question has answer choices, otherwise "open_ended".'),
      options: z
        .array(z.string())
        .describe("MCQ answer choices without letter prefixes. Empty array for open_ended."),
      correct_answer: z
        .string()
        .describe("For mcq: exactly one of the options, copied verbatim. For open_ended: the model answer."),
      explanation: z.string().describe("Step-by-step worked solution a BBA student can follow."),
      tags: z.array(z.string()).describe("2-4 short lowercase topic tags, e.g. 'npv', 'depreciation'."),
    }),
  ),
});
export type ParsedQuiz = z.infer<typeof ParsedQuizSchema>;
export type ParsedQuestion = ParsedQuiz["questions"][number];
export type NormalizedQuestion = Omit<ParsedQuestion, "question_type"> & { question_type: "mcq" | "open_ended" };

// ─── Request body schemas ─────────────────────────────────────────────────

const platform = z.enum(["ms_teams", "google_classroom", "manual"]);

export const ParseAssignmentRequest = z.object({
  text: z.string().trim().min(5, "Paste some text first.").max(100_000, "Text is too long (100k chars max)."),
  source_platform: platform.default("manual"),
  default_course_code: z.string().trim().max(10).nullish(),
});

export const ParseQuizRequest = z.object({
  text: z.string().trim().min(10, "Paste some quiz text first.").max(100_000, "Text is too long (100k chars max)."),
  course_code: z.string().trim().min(5).max(10),
});

export const GenerateVariationRequest = z.object({
  course_code: z.string().trim().min(5).max(10),
  question_ids: z.array(z.string().uuid()).max(30).optional(),
  count: z.number().int().min(1).max(20).default(5),
  save: z.boolean().default(true),
});

export const UpdateAssignmentRequest = z.object({
  status: z.enum(["pending", "completed"]),
});

export const PracticeSessionRequest = z.object({
  course_code: z.string().trim().max(10).nullish(),
  score: z.number().int().min(0),
  total_questions: z.number().int().min(1),
  missed_tags: z.array(z.string().max(50)).max(100).default([]),
  mode: z.enum(["bank", "ai_variation"]).default("bank"),
});

export const TutorRequest = z.object({
  course_code: z.string().trim().min(5).max(10),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(40),
});

export const CreateCourseRequest = z.object({
  course_code: z.string().trim().min(5).max(10),
  name: z.string().trim().min(1).max(200),
  professor: z.string().trim().max(200).nullish(),
  semester: z.string().trim().max(50).nullish(),
});

export const CreateMaterialRequest = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000).nullish().or(z.literal("")),
  notes: z.string().trim().max(5000).nullish(),
});

/** Payload accepted from Make.com / n8n. Accepts one item or a batch. */
const WebhookItem = z.object({
  source_platform: z
    .string()
    .transform((v) => v.toLowerCase().replace(/[\s-]/g, "_"))
    .pipe(
      z
        .enum(["ms_teams", "teams", "microsoft_teams", "google_classroom", "classroom", "gclassroom"])
        .transform((v) => (["ms_teams", "teams", "microsoft_teams"].includes(v) ? "ms_teams" : "google_classroom")),
    ),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).nullish(),
  due_date: z.string().max(100).nullish(),
  course_code: z.string().max(20).nullish(),
  course_name: z.string().max(200).nullish(),
  external_link: z.string().max(2000).nullish(),
  external_id: z.string().max(500).nullish(),
  /** Alternative to structured fields: raw text (e.g. an email body) for the AI to parse. */
  raw_text: z.string().max(50_000).nullish(),
});
export type WebhookItem = z.infer<typeof WebhookItem>;

export const WebhookPayload = z.union([
  z.object({ assignments: z.array(WebhookItem).min(1).max(100) }),
  WebhookItem.transform((item) => ({ assignments: [item] })),
]);
