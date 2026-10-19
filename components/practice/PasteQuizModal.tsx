"use client";

import { CheckCircle2, ClipboardPaste, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import FileDrop from "@/components/ui/FileDrop";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import type { QuizQuestion } from "@/lib/types";

const PLACEHOLDER = `Paste scraped Google Forms / Moodle / PDF quiz text, e.g.

1. Which of the following increases the NPV of a project? *
1 point
A. Higher discount rate
B. Higher initial investment
C. Higher annual cash inflows
D. Longer payback period

2. Compute the WACC given E = 60%, D = 40%, rE = 12%, rD = 6%, tax = 20%.

Answer key: 1-C`;

export default function PasteQuizModal({
  open,
  onClose,
  courses,
  defaultCourse,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  courses: string[];
  defaultCourse: string;
  onCreated: (questions: QuizQuestion[]) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [course, setCourse] = useState(defaultCourse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; message?: string } | null>(null);

  useEffect(() => {
    if (open) setCourse(defaultCourse);
  }, [open, defaultCourse]);

  function close() {
    if (loading) return;
    setResult(null);
    setError(null);
    onClose();
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("text", text);
      form.set("course_code", course);
      files.forEach((f) => form.append("files", f));
      const res = await api<{ questions: QuizQuestion[]; message?: string }>("/api/parse-quiz", { body: form });
      setResult({ count: res.questions.length, message: res.message });
      if (res.questions.length) {
        onCreated(res.questions);
        setText("");
        setFiles([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Drop / Paste Quiz"
      description="AI structures the questions, finds the answers and writes step-by-step explanations."
      wide
    >
      {result && result.count > 0 ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-2 font-medium">
            Saved {result.count} question{result.count > 1 ? "s" : ""} to {course}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-secondary" onClick={() => setResult(null)}>
              Paste another
            </button>
            <button className="btn-primary" onClick={close}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Course</label>
            <input
              className="input font-mono uppercase"
              list="quiz-course-list"
              value={course}
              placeholder="FN201"
              onChange={(e) => setCourse(e.target.value.toUpperCase())}
              disabled={loading}
            />
            <datalist id="quiz-course-list">
              {courses.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <FileDrop files={files} onChange={setFiles} disabled={loading} hint="Quiz or exam PDF, or a photo/screenshot of questions" />
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or paste text <span className="h-px flex-1 bg-slate-200" />
          </div>
          <textarea
            className="input min-h-[200px] font-mono text-xs leading-relaxed"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
          />
          {result?.message && <p className="text-sm text-amber-700">{result.message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-xs text-slate-400">Large quizzes can take up to a minute.</p>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={close} disabled={loading}>
                Cancel
              </button>
              <button className="btn-primary" onClick={submit} disabled={loading || (text.trim().length < 10 && files.length === 0) || course.length < 5}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
                {loading ? "Structuring…" : "Parse & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
