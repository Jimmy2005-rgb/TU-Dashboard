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
  text: z.string().trim().max(100_000, "Text is too long (100k chars max).").default(""),
  source_platform: platform.default("manual"),
  default_course_code: z.string().trim().max(10).nullish(),
});

export const ParseQuizRequest = z.object({
  text: z.string().trim().max(100_000, "Text is too long (100k chars max).").default(""),
  course_code: z.string().trim().min(5).max(10),
});

export const GenerateVariationRequest = z.object({
  course_code: z.string().trim().min(5).max(10),
  question_ids: z.array(z.string().uuid()).max(30).optional(),
  count: z.number().int().min(1).max(20).default(5),
  save: z.boolean().default(true),
});

export const CreateAssignmentRequest = z.object({
  title: z.string().trim().min(1, "Give the assignment a title.").max(500),
  course_code: z.string().trim().max(20).nullish(),
  source_platform: platform.default("manual"),
  /** ISO string, or "YYYY-MM-DDTHH:mm" from a date picker (read as Bangkok time). */
  due_date: z.string().trim().max(100).nullish(),
  description: z.string().trim().max(20_000).nullish(),
  external_link: z.string().trim().url("Link must be a full URL (https://…).").max(2000).nullish().or(z.literal("")),
});

export const CreateQuestionRequest = z
  .object({
    course_code: z.string().trim().min(5).max(10),
    question_type: z.enum(["mcq", "open_ended"]),
    question_text: z.string().trim().min(1, "Write the question.").max(20_000),
    options: z.array(z.string().trim().max(2000)).max(10).default([]),
    correct_answer: z.string().trim().min(1, "Give the correct answer.").max(20_000),
    explanation: z.string().trim().max(20_000).nullish(),
    tags: z.array(z.string().trim().toLowerCase().max(50)).max(10).default([]),
  })
  .transform((q) => ({ ...q, options: q.question_type === "mcq" ? q.options.filter(Boolean) : [] }))
  .refine((q) => q.question_type === "open_ended" || q.options.length >= 2, {
    message: "Multiple choice needs at least 2 choices.",
    path: ["options"],
  })
  .refine((q) => q.question_type === "open_ended" || q.options.includes(q.correct_answer), {
    message: "Pick which choice is correct.",
    path: ["correct_answer"],
  });

/** Any subset of fields; null clears an optional field (e.g. due_date: null = no deadline). */
export const UpdateAssignmentRequest = z
  .object({
    status: z.enum(["pending", "completed"]),
    title: z.string().trim().min(1, "Title can't be empty.").max(500),
    course_code: z.string().trim().max(20).nullable(),
    source_platform: platform,
    due_date: z.string().trim().max(100).nullable(),
    description: z.string().trim().max(20_000).nullable(),
    external_link: z.string().trim().url("Link must be a full URL (https://…).").max(2000).nullable().or(z.literal("")),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });

export const PracticeSessionRequest = z.object({
  course_code: z.string().trim().max(10).nullish(),
  score: z.number().int().min(0),
  total_questions: z.number().int().min(1),
  missed_tags: z.array(z.string().max(50)).max(100).default([]),
  mode: z.enum(["bank", "ai_variation", "review"]).default("bank"),
  /** Per-question results for saved questions, used to schedule mistake reviews. */
  results: z.array(z.object({ question_id: z.string().uuid(), correct: z.boolean() })).max(200).default([]),
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
  /** 1–14, or null for automatic. Omit to leave unchanged. */
  color: z.number().int().min(1).max(14).nullable().optional(),
});

export const CreateMaterialRequest = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000).nullish().or(z.literal("")),
  notes: z.string().trim().max(5000).nullish(),
  kind: z.enum(["material", "exercise"]).default("material"),
  /** Set after the browser has uploaded the file with a signed upload URL. */
  file_path: z.string().max(500).nullish(),
  file_name: z.string().max(300).nullish(),
  file_size: z.number().int().min(0).nullish(),
  mime_type: z.string().max(200).nullish(),
});

export const UploadUrlRequest = z.object({
  file_name: z.string().trim().min(1).max(300),
  file_size: z.number().int().min(1, "That file is empty.").max(50 * 1024 * 1024, "Files can be up to 50 MB."),
});

export const UpdateMaterialRequest = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(["material", "exercise"]).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
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

// ─── Grades ───────────────────────────────────────────────────────────────

const weight = z.coerce.number().min(0, "Weight can't be negative.").max(100, "Weight can't be over 100%.");

export const CreateComponentsRequest = z.object({
  components: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Give each part a name.").max(200),
        weight,
        description: z.string().trim().max(2000).nullish(),
      }),
    )
    .min(1)
    .max(30),
  /** Delete this course's existing parts (and their scores) first. */
  replace: z.boolean().default(false),
});

export const UpdateComponentRequest = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  weight: weight.optional(),
});

export const CreateGradeItemRequest = z
  .object({
    component_id: z.string().uuid(),
    title: z.string().trim().min(1, "Name this result, e.g. Quiz 1.").max(200),
    score: z.coerce.number().min(0, "Score can't be negative."),
    max_score: z.coerce.number().positive("Out of must be more than 0."),
    taken_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish()
      .or(z.literal("")),
    notes: z.string().trim().max(2000).nullish(),
  })
  .refine((i) => i.score <= i.max_score * 1.5, { message: "Score looks bigger than the maximum.", path: ["score"] });

export const UpdateCourseTargetRequest = z.object({
  target_percent: z.coerce.number().min(0).max(100),
});

export const ParseOutlineRequest = z.object({
  course_code: z.string().trim().min(5).max(10),
  text: z.string().trim().max(100_000).default(""),
});

/** What the AI extracts from a course outline / syllabus. */
export const ParsedOutlineSchema = z.object({
  course_name: z.string().nullable().describe("Full course name if stated, else null."),
  professor: z.string().nullable().describe("Instructor name(s) if stated, else null."),
  components: z
    .array(
      z.object({
        name: z.string().describe("Graded part, e.g. 'Midterm exam', 'Quizzes', 'Group project', 'Class participation'."),
        weight: z.number().describe("Percent of the final grade, e.g. 30 for 30%."),
        description: z.string().nullable().describe("Short detail: number of quizzes, format, date if given. Else null."),
      }),
    )
    .describe("The grading breakdown. Weights should add up to 100."),
  deadlines: z.array(
    z.object({
      title: z.string(),
      due_date: z.string().nullable().describe("ISO 8601 with +07:00 offset, or null if no exact date."),
      description: z.string().nullable(),
    }),
  ),
});
export type ParsedOutline = z.infer<typeof ParsedOutlineSchema>;

// ─── Timetable, exams, mistake review ─────────────────────────────────────

const timeOfDay = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3])[:.][0-5]\d$/, "Use a time like 09:30.")
  .transform((t) => t.replace(".", ":").padStart(5, "0"));
const dateKey = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-10.");

export const ClassSlotInput = z
  .object({
    course_code: z.string().trim().min(5).max(10),
    weekday: z.coerce.number().int().min(1).max(7),
    start_time: timeOfDay,
    end_time: timeOfDay,
    room: z.string().trim().max(100).nullish(),
    section: z.string().trim().max(50).nullish(),
  })
  .refine((s) => s.end_time > s.start_time, { message: "The class must end after it starts.", path: ["end_time"] });

export const CreateSlotsRequest = z.object({
  slots: z.array(ClassSlotInput).min(1).max(80),
  /** Replace the whole timetable (used by the AI import). */
  replace: z.boolean().default(false),
});

export const UpdateStudySettingsRequest = z
  .object({
    semester_start: dateKey.nullable(),
    semester_end: dateKey.nullable(),
    no_class_days: z
      .array(z.object({ start: dateKey, end: dateKey, label: z.string().trim().max(100).default("") }))
      .max(60)
      .default([]),
  })
  .refine((s) => !s.semester_start || !s.semester_end || s.semester_end >= s.semester_start, {
    message: "The semester must end after it starts.",
    path: ["semester_end"],
  });

const examKind = z.enum(["midterm", "final", "quiz", "presentation", "other"]);

export const CreateExamRequest = z.object({
  course_code: z.string().trim().min(5).max(10),
  kind: examKind.default("other"),
  title: z.string().trim().min(1, "Give the exam a name.").max(200),
  /** ISO, or "YYYY-MM-DDTHH:mm" read as Bangkok time. */
  starts_at: z.string().trim().min(10, "Pick the exam date.").max(100),
  ends_at: z.string().trim().max(100).nullish().or(z.literal("")),
  room: z.string().trim().max(100).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  component_id: z.string().uuid().nullish().or(z.literal("")),
});

export const UpdateExamRequest = z
  .object({
    kind: examKind,
    title: z.string().trim().min(1).max(200),
    starts_at: z.string().trim().min(10).max(100),
    ends_at: z.string().trim().max(100).nullable(),
    room: z.string().trim().max(100).nullable(),
    notes: z.string().trim().max(2000).nullable(),
    component_id: z.string().uuid().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });

export const ParseScheduleRequest = z.object({
  text: z.string().trim().max(100_000).default(""),
});

/** What the AI extracts from a timetable / exam schedule / academic calendar. */
export const ParsedScheduleSchema = z.object({
  classes: z
    .array(
      z.object({
        course_code: z.string().describe("Course code like AC201 (letters + 3 digits, no space)."),
        course_name: z.string().nullable(),
        weekday: z.number().describe("1 = Monday, 2 = Tuesday … 7 = Sunday."),
        start_time: z.string().describe("24-hour HH:MM, e.g. 09:30."),
        end_time: z.string().describe("24-hour HH:MM, e.g. 12:30."),
        room: z.string().nullable(),
        section: z.string().nullable(),
      }),
    )
    .describe("Weekly class meetings. One entry per course per weekday."),
  exams: z.array(
    z.object({
      course_code: z.string(),
      kind: z.string().describe('"midterm", "final", "quiz", "presentation" or "other".'),
      title: z.string().describe("e.g. 'AC201 Midterm exam'."),
      starts_at: z.string().describe("ISO 8601 with +07:00 offset."),
      ends_at: z.string().nullable().describe("ISO 8601 with +07:00 offset, or null."),
      room: z.string().nullable(),
    }),
  ),
  semester_start: z.string().nullable().describe("First day of classes, YYYY-MM-DD, if stated."),
  semester_end: z.string().nullable().describe("Last day of classes, YYYY-MM-DD, if stated."),
  no_class_days: z
    .array(z.object({ start: z.string(), end: z.string(), label: z.string() }))
    .describe("Holidays, midterm week, reading week — days with no classes (YYYY-MM-DD, end inclusive)."),
});
export type ParsedSchedule = z.infer<typeof ParsedScheduleSchema>;
