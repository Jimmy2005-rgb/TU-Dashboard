import { BookOpen, BrainCircuit, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import AddCourseButton from "@/components/courses/AddCourseButton";
import SetupNotice from "@/components/SetupNotice";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: "Courses" };
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  let db;
  try {
    db = getSupabaseAdmin();
  } catch (err) {
    return <SetupNotice message={(err as Error).message} />;
  }
  const userId = getOwnerId();

  const [courses, assignments, quiz, materials] = await Promise.all([
    db.from("courses").select("*").order("course_code"),
    db.from("assignments").select("course_code, status").eq("user_id", userId),
    db.from("quiz_bank").select("course_code"),
    db.from("course_materials").select("course_code").eq("user_id", userId),
  ]);
  const error = courses.error ?? assignments.error ?? quiz.error ?? materials.error;
  if (error) return <SetupNotice message={`Database error: ${error.message}. Did you run supabase/schema.sql?`} />;

  const stats = new Map<string, { total: number; done: number; quiz: number; materials: number }>();
  const get = (code: string) => {
    if (!stats.has(code)) stats.set(code, { total: 0, done: 0, quiz: 0, materials: 0 });
    return stats.get(code)!;
  };
  for (const a of assignments.data ?? []) {
    if (!a.course_code) continue;
    const s = get(a.course_code);
    s.total++;
    if (a.status === "completed") s.done++;
  }
  for (const q of quiz.data ?? []) get(q.course_code).quiz++;
  for (const m of materials.data ?? []) get(m.course_code).materials++;

  const list = (courses.data ?? []) as Course[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-sm text-slate-500">Progress, materials, saved questions and your AI tutor per course.</p>
        </div>
        <AddCourseButton />
      </div>

      {list.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-sm text-slate-500">
          No courses yet. Add one, or run <code className="rounded bg-slate-100 px-1">supabase/seed.sql</code>.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const s = stats.get(c.course_code) ?? { total: 0, done: 0, quiz: 0, materials: 0 };
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <Link
                key={c.id}
                href={`/courses/${c.course_code}`}
                className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-tu-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-tu-600">{c.course_code}</p>
                    <h2 className="mt-0.5 font-semibold leading-snug text-slate-900 group-hover:text-tu-700">{c.name}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[c.professor, c.semester && `Sem ${c.semester}`].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <BookOpen className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-tu-400" />
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Assignments</span>
                    <span>
                      {s.done}/{s.total} done
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-tu-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> {s.materials} materials
                  </span>
                  <span className="flex items-center gap-1">
                    <BrainCircuit className="h-3.5 w-3.5" /> {s.quiz} questions
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
