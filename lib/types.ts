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

export interface CourseMaterial {
  id: string;
  user_id: string;
  course_code: string;
  title: string;
  url: string | null;
  notes: string | null;
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

export const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  ms_teams: "MS Teams",
  google_classroom: "Google Classroom",
  manual: "Manual",
};
