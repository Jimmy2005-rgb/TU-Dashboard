export type SourcePlatform = "ms_teams" | "google_classroom" | "manual";
export type AssignmentStatus = "pending" | "completed";
export type QuestionType = "mcq" | "open_ended";

export interface Course {
  id: string;
  course_code: string;
  name: string;
  professor: string | null;
  semester: string | null;
  target_percent: number;
  /** Colour slot 1–14, or null for automatic. */
  color: number | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  user_id: string;
  course_code: string | null;
  source_platform: SourcePlatform;
  external_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: AssignmentStatus;
  external_link: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  course_code: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  tags: string[];
  source: "pasted" | "ai_variation" | "manual";
  created_at: string;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  course_code: string | null;
  score: number;
  total_questions: number;
  summary: string | null;
  created_at: string;
}

export type MaterialKind = "material" | "exercise";

export interface CourseMaterial {
  id: string;
  user_id: string;
  course_code: string;
  title: string;
  url: string | null;
  notes: string | null;
  kind: MaterialKind;
  /** Set when the material is an uploaded file (path inside the course-files bucket). */
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface GradeComponent {
  id: string;
  user_id: string;
  course_code: string;
  name: string;
  weight: number;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface GradeItem {
  id: string;
  user_id: string;
  component_id: string;
  title: string;
  score: number;
  max_score: number;
  taken_on: string | null;
  notes: string | null;
  created_at: string;
}

/** A weekly class time. weekday: 1 = Monday … 7 = Sunday; times are "HH:MM" or "HH:MM:SS" (Bangkok). */
export interface ClassSlot {
  id: string;
  user_id: string;
  course_code: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  section: string | null;
  created_at: string;
}

export interface NoClassPeriod {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (inclusive)
  label: string;
}

export interface StudySettings {
  user_id: string;
  semester_start: string | null; // YYYY-MM-DD
  semester_end: string | null;
  no_class_days: NoClassPeriod[];
  updated_at: string;
}

export type ExamKind = "midterm" | "final" | "quiz" | "presentation" | "other";

export const EXAM_KIND_LABELS: Record<ExamKind, string> = {
  midterm: "Midterm",
  final: "Final",
  quiz: "Quiz",
  presentation: "Presentation",
  other: "Other",
};

export interface Exam {
  id: string;
  user_id: string;
  course_code: string;
  kind: ExamKind;
  title: string;
  starts_at: string;
  ends_at: string | null;
  room: string | null;
  notes: string | null;
  component_id: string | null;
  created_at: string;
}

/** A question answered wrong, scheduled for spaced review. due_at null = mastered. */
export interface QuestionReview {
  question_id: string;
  user_id: string;
  course_code: string;
  box: number;
  due_at: string | null;
  wrong_count: number;
  right_count: number;
  last_answered_at: string;
}

export const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  ms_teams: "MS Teams",
  google_classroom: "Google Classroom",
  manual: "Manual",
};
