"use client";

import { Bot, Eraser, Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Course } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarise the key formulas I need for the midterm",
  "Give me a worked example on the hardest topic",
  "Quiz me with 3 short questions",
  "Explain this concept like I'm seeing it for the first time:",
];

export default function TutorPanel({ course, open, onClose }: { course: Course; open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const history: Msg[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only send the last 20 turns to keep requests small.
        body: JSON.stringify({ course_code: course.course_code, messages: history.slice(-20) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `_Error: ${(err as Error).message}_` };
        return next;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${course.course_code} tutor`}>
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl animate-slide-in flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tu-600 text-gold-500">
              <Bot className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{course.course_code} Tutor</p>
              <p className="text-xs text-slate-500">{course.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={clear} className="btn-ghost px-2" aria-label="Clear conversation">
                <Eraser className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost px-2" aria-label="Close tutor">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="pt-6 text-center">
              <Bot className="mx-auto h-10 w-10 text-tu-200" />
              <p className="mt-2 text-sm font-medium text-slate-700">Ask anything about {course.course_code}</p>
              <p className="text-xs text-slate-500">Concepts, worked examples, exam prep. Thai or English.</p>
              <div className="mt-4 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => (s.endsWith(":") ? setInput(s + " ") : send(s))} className="chip-off justify-center py-1.5">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-tu-600 px-3.5 py-2 text-sm text-white">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100">
                  <Bot className="h-3.5 w-3.5 text-tu-600" />
                </div>
                <div className="prose-tutor min-w-0 max-w-[90%]">
                  {m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : (
                    <Loader2 className="mt-1 h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-slate-200 p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              className="input max-h-40 min-h-[44px] resize-none"
              rows={1}
              placeholder={`Ask the ${course.course_code} tutor…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button type="submit" className="btn-primary h-[44px] px-3" disabled={streaming || !input.trim()} aria-label="Send">
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">AI can make mistakes — double-check numbers before submitting work.</p>
        </form>
      </aside>
    </div>
  );
}
