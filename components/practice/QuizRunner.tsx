"use client";

import clsx from "clsx";
import { ArrowRight, CheckCircle2, Eye, X, XCircle } from "lucide-react";
import { useState } from "react";
import { CourseBadge, Tag } from "@/components/ui/badges";
import type { QuizQuestion } from "@/lib/types";

export type AnswerRecord = { question: QuizQuestion; given: string; correct: boolean };

export default function QuizRunner({
  questions,
  title,
  onExit,
  onFinish,
}: {
  questions: QuizQuestion[];
  title: string;
  onExit: () => void;
  onFinish: (answers: AnswerRecord[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  const q = questions[index];
  const current = answers[index];
  const score = answers.filter((a) => a.correct).length;
  const isLast = index === questions.length - 1;

  function record(given: string, correct: boolean) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = { question: q, given, correct };
      return next;
    });
  }

  function chooseOption(option: string) {
    if (current) return;
    setSelected(option);
    setRevealed(true);
    record(option, option === q.correct_answer);
  }

  function next() {
    if (isLast) {
      onFinish(answers);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setOpenAnswer("");
    setRevealed(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            Question {index + 1} of {questions.length} · Score {score}/{answers.filter(Boolean).length}
          </p>
        </div>
        <button className="btn-ghost" onClick={() => confirm("Exit this practice run? Progress won't be saved.") && onExit()}>
          <X className="h-4 w-4" /> Exit
        </button>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-tu-600 transition-all" style={{ width: `${((index + (current ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="card p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <CourseBadge code={q.course_code} />
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {q.question_type === "mcq" ? "Multiple choice" : "Open-ended"}
          </span>
          {q.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">{q.question_text}</p>

        {q.question_type === "mcq" ? (
          <div className="mt-5 space-y-2">
            {q.options.map((option, i) => {
              const isCorrect = option === q.correct_answer;
              const isChosen = option === selected;
              return (
                <button
                  key={i}
                  onClick={() => chooseOption(option)}
                  disabled={Boolean(current)}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition",
                    !current && "border-slate-200 hover:border-tu-300 hover:bg-tu-50/40",
                    current && isCorrect && "border-emerald-300 bg-emerald-50 text-emerald-900",
                    current && isChosen && !isCorrect && "border-red-300 bg-red-50 text-red-900",
                    current && !isChosen && !isCorrect && "border-slate-200 opacity-60",
                  )}
                >
                  <span className="mt-px font-mono text-xs font-semibold text-slate-400">{String.fromCharCode(65 + i)}</span>
                  <span className="flex-1">{option}</span>
                  {current && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                  {current && isChosen && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-5">
            <textarea
              className="input min-h-[120px]"
              placeholder="Work out your answer here, then reveal the model answer."
              value={openAnswer}
              onChange={(e) => setOpenAnswer(e.target.value)}
              disabled={revealed}
            />
            {!revealed && (
              <button className="btn-secondary mt-2" onClick={() => setRevealed(true)}>
                <Eye className="h-4 w-4" /> Reveal model answer
              </button>
            )}
          </div>
        )}

        {revealed && (
          <div className="mt-5 space-y-3">
            {q.question_type === "open_ended" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Model answer</p>
                <p className="whitespace-pre-wrap text-emerald-950">{q.correct_answer}</p>
              </div>
            )}
            {q.explanation && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Explanation</p>
                <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{q.explanation}</p>
              </div>
            )}
            {q.question_type === "open_ended" && !current && (
              <div className="flex flex-wrap gap-2">
                <span className="self-center text-sm text-slate-600">How did you do?</span>
                <button className="btn border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => record(openAnswer, true)}>
                  <CheckCircle2 className="h-4 w-4" /> I got it
                </button>
                <button className="btn border border-red-200 bg-red-50 text-red-700 hover:bg-red-100" onClick={() => record(openAnswer, false)}>
                  <XCircle className="h-4 w-4" /> I missed it
                </button>
              </div>
            )}
          </div>
        )}

        {current && (
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className={clsx("text-sm font-medium", current.correct ? "text-emerald-600" : "text-red-600")}>
              {current.correct ? "Correct!" : "Not quite — review the explanation."}
            </p>
            <button className="btn-primary" onClick={next}>
              {isLast ? "See results" : "Next"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
