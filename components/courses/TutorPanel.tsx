"use client";

import clsx from "clsx";
import {
  AlertCircle,
  Bot,
  Camera,
  Eraser,
  File as FileIcon,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music,
  Paperclip,
  Send,
  Square,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import RichText from "@/components/ui/RichText";
import { api } from "@/components/ui/api";
import { uploadWithProgress } from "@/components/ui/upload";
import { MAX_ATTACHMENT_BYTES, attachmentKind, attachmentMime, type AttachmentKind } from "@/lib/attachment-types";
import type { Course, CourseMaterial } from "@/lib/types";
import { MAX_VOICE_SECONDS, formatSeconds, needsConversion, startRecording, toWav, type Recording } from "./voice";

type Att = {
  id: string;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  size: number;
  /** Storage path once uploaded (or the course material's file). */
  path?: string;
  status: "uploading" | "ready" | "error";
  progress: number;
  error?: string;
  /** Local preview (photos, voice notes) — only in this browser tab. */
  localUrl?: string;
  fromMaterial?: boolean;
};
type Msg = { role: "user" | "assistant"; content: string; attachments?: Att[] };

const SUGGESTIONS = [
  "Summarise the key formulas I need for the midterm",
  "Give me a worked example on the hardest topic",
  "Quiz me with 3 short questions",
  "Explain this concept like I'm seeing it for the first time:",
];

const ACCEPT = "image/*,application/pdf,audio/*,video/mp4,video/quicktime,.txt,.md,.csv,.json,.docx,.pptx,.xlsx";
const MAX_PENDING = 10;

export default function TutorPanel({
  course,
  open,
  onClose,
  materials = [],
}: {
  course: Course;
  open: boolean;
  onClose: () => void;
  materials?: CourseMaterial[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Att[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ rec: Recording; seconds: number; level: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const recRef = useRef<Recording | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !recRef.current && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      recRef.current?.cancel();
    },
    [],
  );

  // Live timer + level meter while recording; stops itself at the length limit.
  useEffect(() => {
    if (!recording) return;
    const started = Date.now() - recording.seconds * 1000;
    const timer = setInterval(() => {
      const seconds = (Date.now() - started) / 1000;
      if (seconds >= MAX_VOICE_SECONDS) void finishRecording();
      else setRecording((r) => (r ? { ...r, seconds, level: r.rec.level() } : r));
    }, 120);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording?.rec]);

  const updateAtt = (id: string, patch: Partial<Att>) => setPending((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  /** Validate, convert (audio), upload to storage, and show progress in the composer. */
  async function addFiles(files: File[]) {
    setNotice(null);
    setMenuOpen(false);
    const room = MAX_PENDING - pending.length;
    if (files.length > room) setNotice(`Up to ${MAX_PENDING} attachments per message.`);
    for (const original of files.slice(0, Math.max(0, room))) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let file = original;
      let mimeType = attachmentMime(file.name, file.type);
      const kind = attachmentKind(mimeType);
      if (!kind) {
        setNotice(`${file.name}: can't be read. Use a photo, PDF, voice note, or a Word/PowerPoint/Excel file.`);
        continue;
      }
      const base: Att = { id, name: file.name, mimeType, kind, size: file.size, status: "uploading", progress: 0 };
      setPending((list) => [...list, base]);
      try {
        if (kind === "audio" && needsConversion(mimeType)) {
          file = await toWav(file, file.name);
          mimeType = "audio/wav";
          updateAtt(id, { name: file.name, mimeType, size: file.size });
        }
        if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Too big — the tutor reads files up to 15 MB.");
        const localUrl = kind === "image" || kind === "audio" ? URL.createObjectURL(file) : undefined;
        updateAtt(id, { localUrl });
        const { signedUrl, path } = await api<{ signedUrl: string; path: string }>("/api/tutor/upload-url", {
          body: { course_code: course.course_code, file_name: file.name, file_size: file.size },
        });
        await uploadWithProgress(signedUrl, file, (progress) => updateAtt(id, { progress }));
        updateAtt(id, { path, status: "ready", progress: 100 });
      } catch (err) {
        updateAtt(id, { status: "error", error: (err as Error).message });
      }
    }
  }

  function attachMaterial(m: CourseMaterial) {
    setPickerOpen(false);
    setMenuOpen(false);
    if (!m.file_path || pending.some((a) => a.path === m.file_path)) return;
    const mimeType = attachmentMime(m.file_name ?? m.title, m.mime_type);
    const kind = attachmentKind(mimeType);
    if (!kind) {
      setNotice(`${m.file_name ?? m.title}: the tutor can't read this file type.`);
      return;
    }
    if ((m.file_size ?? 0) > MAX_ATTACHMENT_BYTES) {
      setNotice(`${m.title}: too big for the tutor (15 MB max). Ask about a smaller part, or attach a few pages as PDF.`);
      return;
    }
    setPending((list) => [
      ...list,
      { id: m.id, name: m.file_name ?? m.title, mimeType, kind, size: m.file_size ?? 0, path: m.file_path!, status: "ready", progress: 100, fromMaterial: true },
    ]);
  }

  function removePending(a: Att) {
    setPending((list) => list.filter((x) => x.id !== a.id));
    if (a.localUrl) URL.revokeObjectURL(a.localUrl);
    if (a.path && !a.fromMaterial) void deleteUploads([a.path]);
  }

  function deleteUploads(paths: string[]) {
    if (!paths.length) return Promise.resolve();
    return api("/api/tutor/files", { method: "DELETE", body: { course_code: course.course_code, paths } }).catch(() => undefined);
  }

  async function beginRecording() {
    setNotice(null);
    setMenuOpen(false);
    try {
      const rec = await startRecording();
      recRef.current = rec;
      setRecording({ rec, seconds: 0, level: 0 });
    } catch (err) {
      setNotice((err as Error).message);
    }
  }

  async function finishRecording(sendNow = false) {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    setRecording(null);
    try {
      const file = await rec.stop();
      if (!file) return setNotice("That recording was too short.");
      await addFiles([file]);
      if (sendNow) setSendAfterUpload(true);
    } catch (err) {
      setNotice((err as Error).message);
    }
  }

  function cancelRecording() {
    recRef.current?.cancel();
    recRef.current = null;
    setRecording(null);
  }

  // "Send" while recording: wait for the voice note to finish uploading, then send.
  const [sendAfterUpload, setSendAfterUpload] = useState(false);
  const uploading = pending.some((a) => a.status === "uploading");
  useEffect(() => {
    if (sendAfterUpload && !uploading && pending.length) {
      setSendAfterUpload(false);
      void send(input);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendAfterUpload, uploading]);

  const ready = pending.filter((a) => a.status === "ready");
  const canSend = !streaming && !uploading && (input.trim().length > 0 || ready.length > 0);

  async function send(text: string) {
    const content = text.trim();
    const attachments = pending.filter((a) => a.status === "ready");
    if ((!content && !attachments.length) || streaming) return;

    const history: Msg[] = [...messages, { role: "user", content, attachments }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setPending([]);
    setNotice(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only send the last 20 turns to keep requests small.
        body: JSON.stringify({
          course_code: course.course_code,
          messages: history.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
            attachments: (m.attachments ?? []).map((a) => ({ path: a.path, name: a.name, mime_type: a.mimeType })),
          })),
        }),
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
      // Drop the failed turn so a bad attachment doesn't break the next message; put it back in the composer.
      setMessages((prev) => prev.slice(0, -2));
      setInput(content);
      setPending(attachments);
      setNotice((err as Error).message);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function clear() {
    abortRef.current?.abort();
    const uploaded = [...messages.flatMap((m) => m.attachments ?? []), ...pending].filter((a) => a.path && !a.fromMaterial).map((a) => a.path!);
    void deleteUploads(uploaded);
    [...messages.flatMap((m) => m.attachments ?? []), ...pending].forEach((a) => a.localUrl && URL.revokeObjectURL(a.localUrl));
    setMessages([]);
    setPending([]);
    setStreaming(false);
  }

  if (!open) return null;

  const fileMaterials = materials.filter((m) => m.file_path);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${course.course_code} tutor`}>
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <aside
        className="relative flex h-full w-full max-w-xl animate-slide-in flex-col bg-surface shadow-2xl"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles([...e.dataTransfer.files]);
        }}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-tu-400 bg-surface/90 text-sm font-medium text-tu-700">
            <Paperclip className="mb-2 h-6 w-6" /> Drop to attach
          </div>
        )}

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
              <button onClick={clear} className="btn-ghost px-2" aria-label="Clear conversation" title="Clear conversation (also deletes files you attached here)">
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
              <p className="text-xs text-slate-500">Type, send a voice note, or attach a photo of your homework, slides or a PDF. Thai or English.</p>
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
              <div key={i} className="flex flex-col items-end gap-1.5">
                {m.attachments && m.attachments.length > 0 && <SentAttachments items={m.attachments} />}
                {m.content && (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-tu-600 px-3.5 py-2 text-sm text-white">{m.content}</div>
                )}
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100">
                  <Bot className="h-3.5 w-3.5 text-tu-600" />
                </div>
                <div className="prose-tutor min-w-0 max-w-[90%]">
                  {m.content ? <RichText>{m.content}</RichText> : <Loader2 className="mt-1 h-4 w-4 animate-spin text-slate-400" />}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="relative border-t border-slate-200 p-3"
        >
          {notice && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{notice}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </p>
          )}

          {pending.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {pending.map((a) => (
                <PendingChip key={a.id} a={a} onRemove={() => removePending(a)} />
              ))}
            </ul>
          )}

          {menuOpen && (
            <div className="absolute bottom-full left-3 z-10 mb-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1 shadow-lift">
              <MenuItem icon={Paperclip} label="Photo or file" sub="PDF, images, Word, PowerPoint, Excel, audio" onClick={() => fileInput.current?.click()} />
              <MenuItem icon={Camera} label="Take a photo" sub="Use your phone camera" onClick={() => cameraInput.current?.click()} />
              {fileMaterials.length > 0 && (
                <MenuItem icon={FolderOpen} label="From course materials" sub={`${fileMaterials.length} file${fileMaterials.length > 1 ? "s" : ""} in ${course.course_code}`} onClick={() => setPickerOpen(true)} />
              )}
            </div>
          )}

          {pickerOpen && (
            <div className="absolute bottom-full left-3 right-3 z-10 mb-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-surface p-1 shadow-lift">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course materials</p>
                <button type="button" onClick={() => setPickerOpen(false)} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {fileMaterials.map((m) => (
                <button key={m.id} type="button" onClick={() => attachMaterial(m)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100">
                  <KindIcon kind={attachmentKind(attachmentMime(m.file_name ?? m.title, m.mime_type))} />
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  <span className="shrink-0 text-[10px] uppercase text-slate-400">{m.kind === "exercise" ? "Exercise" : "Material"}</span>
                </button>
              ))}
            </div>
          )}

          <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => (void addFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (void addFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />

          {recording ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={cancelRecording} className="btn-ghost h-[44px] px-3" aria-label="Cancel recording">
                <X className="h-4 w-4" />
              </button>
              <div className="flex h-[44px] flex-1 items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                <span className="text-sm font-medium tabular-nums text-red-800">{formatSeconds(recording.seconds)}</span>
                <span className="flex h-5 flex-1 items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 24 }, (_, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-red-400 transition-all"
                      style={{ height: `${Math.max(12, Math.min(100, recording.level * 100 * (0.5 + Math.abs(Math.sin(i * 1.7 + recording.seconds * 6)) * 0.8)))}%` }}
                    />
                  ))}
                </span>
                <span className="hidden text-[11px] text-red-700 sm:inline">max {formatSeconds(MAX_VOICE_SECONDS)}</span>
              </div>
              <button type="button" onClick={() => void finishRecording()} className="btn-secondary h-[44px] px-3" title="Stop and add to message">
                <Square className="h-4 w-4" /> Done
              </button>
              <button type="button" onClick={() => void finishRecording(true)} className="btn-primary h-[44px] px-3" aria-label="Stop and send">
                <Send className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setMenuOpen((v) => !v);
                }}
                className={clsx("btn-ghost h-[44px] px-2.5", menuOpen && "bg-slate-100")}
                aria-label="Attach"
                aria-expanded={menuOpen}
                title="Attach photos, files or course materials"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                className="input max-h-40 min-h-[44px] resize-none"
                rows={1}
                placeholder={pending.length ? "Add a question about this (optional)…" : `Ask the ${course.course_code} tutor…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  const files = [...e.clipboardData.files];
                  if (files.length) {
                    e.preventDefault();
                    void addFiles(files);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (canSend) void send(input);
                  }
                }}
              />
              {input.trim() || pending.length ? (
                <button type="submit" className="btn-primary h-[44px] px-3" disabled={!canSend} aria-label="Send" title={uploading ? "Waiting for uploads…" : "Send"}>
                  {streaming || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              ) : (
                <button type="button" onClick={beginRecording} className="btn-primary h-[44px] px-3" disabled={streaming} aria-label="Record a voice note" title="Record a voice note">
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-slate-400">AI can make mistakes — double-check numbers before submitting work. Paste or drop files to attach.</p>
        </form>
      </aside>
    </div>
  );
}

function KindIcon({ kind, className = "h-4 w-4" }: { kind: AttachmentKind | null; className?: string }) {
  if (kind === "image") return <ImageIcon className={clsx(className, "text-indigo-500")} />;
  if (kind === "pdf") return <FileText className={clsx(className, "text-red-500")} />;
  if (kind === "audio") return <Music className={clsx(className, "text-emerald-600")} />;
  if (kind === "video") return <Video className={clsx(className, "text-amber-600")} />;
  if (kind === "office" || kind === "text") return <FileText className={clsx(className, "text-blue-600")} />;
  return <FileIcon className={clsx(className, "text-slate-500")} />;
}

function MenuItem({ icon: Icon, label, sub, onClick }: { icon: typeof Paperclip; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-100">
      <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-[11px] text-slate-500">{sub}</span>
      </span>
    </button>
  );
}

function PendingChip({ a, onRemove }: { a: Att; onRemove: () => void }) {
  return (
    <li
      className={clsx(
        "relative flex max-w-[14rem] items-center gap-2 rounded-xl border py-1 pl-1 pr-7 text-xs",
        a.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700",
      )}
      title={a.error ?? a.name}
    >
      {a.kind === "image" && a.localUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.localUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
          <KindIcon kind={a.kind} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium">{a.name}</span>
        <span className="block text-[10px] text-slate-500">
          {a.status === "uploading" ? `Uploading ${a.progress}%` : a.status === "error" ? a.error : a.fromMaterial ? "Course material" : `${Math.max(1, Math.round(a.size / 1024))} KB`}
        </span>
      </span>
      {a.status === "uploading" && (
        <span className="absolute inset-x-1 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full bg-tu-600 transition-all" style={{ width: `${a.progress}%` }} />
        </span>
      )}
      <button type="button" onClick={onRemove} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={`Remove ${a.name}`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function SentAttachments({ items }: { items: Att[] }) {
  return (
    <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
      {items.map((a) =>
        a.kind === "image" && a.localUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={a.localUrl} alt={a.name} className="max-h-40 rounded-xl border border-slate-200 object-cover" />
        ) : a.kind === "audio" && a.localUrl ? (
          <audio key={a.id} src={a.localUrl} controls className="h-10 max-w-full" />
        ) : (
          <span key={a.id} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
            <KindIcon kind={a.kind} className="h-3.5 w-3.5" />
            <span className="max-w-[12rem] truncate">{a.name}</span>
          </span>
        ),
      )}
    </div>
  );
}
