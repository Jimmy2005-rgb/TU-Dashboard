"use client";

import clsx from "clsx";
import { CheckCircle2, Circle, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { api } from "@/components/ui/api";
import type { QuestionType, QuizQuestion } from "@/lib/types";

const blank = (course: string) => ({
  course_code: course,
  question_type: "mcq" as QuestionType,
  question_text: "",
  options: ["", "", "", ""],
  correctIndex: -1,
  open_answer: "",
  explanation: "",
  tags: "",
});

/** Plain form for writing a quiz question by hand — works without any AI key. */
export default function AddQuestionModal({
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
  onCreated: (question: QuizQuestion) => void;
}) {
  const [form, setForm] = useState(() => blank(defaultCourse));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (open) {
      setForm(blank(defaultCourse));
      setSavedCount(0);
      setError(null);
    }
  }, [open, defaultCourse]);

  const isMcq = form.question_type === "mcq";

  function setOption(i: number, value: string) {
    setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? value : o)) }));
  }

  function removeOption(i: number) {
    setForm((f) => ({
      ...f,
      options: f.options.filter((_, j) => j !== i),
      correctIndex: f.correctIndex === i ? -1 : f.correctIndex > i ? f.correctIndex - 1 : f.correctIndex,
    }));
  }

  async function submit(e: React.FormEvent, addAnother: boolean) {
    e.preventDefault();
    setError(null);
    if (isMcq && (form.correctIndex < 0 || !form.options[form.correctIndex]?.trim())) {
      setError("Tick the circle next to the correct choice.");
      return;
    }
    setLoading(true);
    try {
      const { question } = await api<{ question: QuizQuestion }>("/api/quiz", {
        body: {
          course_code: form.course_code,
          question_type: form.question_type,
          question_text: form.question_text,
          options: isMcq ? form.options.map((o) => o.trim()).filter(Boolean) : [],
          correct_answer: isMcq ? form.options[form.correctIndex].trim() : form.open_answer,
          explanation: form.explanation || null,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      onCreated(question);
      setSavedCount((n) => n + 1);
      if (addAnother) {
        // Keep course, type and tags so a run of similar questions is quick to enter.
        setForm((f) => ({ ...blank(f.course_code), question_type: f.question_type, tags: f.tags }));
      } else {
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const canSave =
    form.course_code.trim().length >= 5 &&
    form.question_text.trim() &&
    (isMcq ? form.options.filter((o) => o.trim()).length >= 2 : form.open_answer.trim());

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title="Add question"
      description={savedCount ? `${savedCount} saved — keep going or close when done.` : "Write a question for your Quiz Vault."}
      wide
    >
      <form onSubmit={(e) => submit(e, false)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="q-course">
              Course
            </label>
            <input
              id="q-course"
              className="input font-mono uppercase"
              list="add-question-courses"
              placeholder="FN201"
              value={form.course_code}
              onChange={(e) => setForm((f) => ({ ...f, course_code: e.target.value.toUpperCase() }))}
              disabled={loading}
            />
            <datalist id="add-question-courses">
              {courses.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <span className="label">Type</span>
            <div className="flex gap-1.5">
              {(["mcq", "open_ended"] as QuestionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, question_type: t }))}
                  className={clsx(form.question_type === t ? "chip-on" : "chip-off", "flex-1 justify-center py-2")}
                  disabled={loading}
                >
                  {t === "mcq" ? "Multiple choice" : "Written answer"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="q-text">
            Question
          </label>
          <textarea
            id="q-text"
            className="input min-h-[90px]"
            placeholder="e.g. A project costs ฿500,000 and returns ฿200,000 a year for 3 years. At 10%, what is the NPV?"
            value={form.question_text}
            onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
            autoFocus
            disabled={loading}
          />
        </div>

        {isMcq ? (
          <div>
            <span className="label">Choices — tick the correct one</span>
            <div className="space-y-2">
              {form.options.map((option, i) => {
                const correct = form.correctIndex === i;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, correctIndex: i }))}
                      className={clsx("shrink-0 rounded-full", correct ? "text-emerald-600" : "text-slate-300 hover:text-emerald-500")}
                      aria-label={`Mark choice ${String.fromCharCode(65 + i)} as correct`}
                      disabled={loading}
                    >
                      {correct ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <span className="w-4 font-mono text-xs font-semibold text-slate-400">{String.fromCharCode(65 + i)}</span>
                    <input
                      className={clsx("input", correct && "border-emerald-400 ring-2 ring-emerald-500/20")}
                      placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                      value={option}
                      onChange={(e) => setOption(i, e.target.value)}
                      disabled={loading}
                    />
                    {form.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Remove choice"
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {form.options.length < 8 && (
              <button
                type="button"
                className="btn-ghost mt-1 px-2 text-xs"
                onClick={() => setForm((f) => ({ ...f, options: [...f.options, ""] }))}
                disabled={loading}
              >
                <Plus className="h-3.5 w-3.5" /> Add choice
              </button>
            )}
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="q-answer">
              Model answer
            </label>
            <textarea
              id="q-answer"
              className="input min-h-[70px]"
              placeholder="e.g. NPV ≈ –฿2,630, so reject the project."
              value={form.open_answer}
              onChange={(e) => setForm((f) => ({ ...f, open_answer: e.target.value }))}
              disabled={loading}
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="q-explain">
            Explanation (shown after you answer)
          </label>
          <textarea
            id="q-explain"
            className="input min-h-[70px]"
            placeholder="Step-by-step working, formula used, common mistakes… (optional)"
            value={form.explanation}
            onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
            disabled={loading}
          />
        </div>

        <div>
          <label className="label" htmlFor="q-tags">
            Topics
          </label>
          <input
            id="q-tags"
            className="input"
            placeholder="npv, capital budgeting (optional, comma separated)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            disabled={loading}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            {savedCount ? "Done" : "Cancel"}
          </button>
          <button type="button" className="btn-secondary" onClick={(e) => submit(e, true)} disabled={loading || !canSave}>
            Save &amp; add another
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !canSave}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
