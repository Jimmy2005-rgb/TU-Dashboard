"use client";

import clsx from "clsx";
import {
  ArrowRightLeft,
  BrainCircuit,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  Plus,
  Presentation,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/components/ui/api";
import { uploadWithProgress } from "@/components/ui/upload";
import { formatDate } from "@/lib/dates";
import type { CourseMaterial, MaterialKind } from "@/lib/types";

const MAX_BYTES = 50 * 1024 * 1024; // Supabase Free plan per-file limit
const AI_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const MAX_AI_BYTES = 15 * 1024 * 1024;

type Tab = "all" | MaterialKind;
type Upload = { id: string; name: string; size: number; progress: number; error?: string };

function sizeLabel(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function guessMime(file: File) {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return (
    { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", heic: "image/heic" } as Record<
      string,
      string
    >
  )[ext] ?? "application/octet-stream";
}

function FileIcon({ m }: { m: CourseMaterial }) {
  const cls = "h-5 w-5 shrink-0";
  if (!m.file_path) return <Link2 className={clsx(cls, "text-slate-400")} />;
  const name = (m.file_name ?? "").toLowerCase();
  const type = m.mime_type ?? "";
  if (type === "application/pdf") return <FileText className={clsx(cls, "text-tu-600")} />;
  if (type.startsWith("image/")) return <FileImage className={clsx(cls, "text-indigo-500")} />;
  if (/\.(pptx?|key)$/.test(name)) return <Presentation className={clsx(cls, "text-orange-500")} />;
  if (/\.(xlsx?|csv|numbers)$/.test(name)) return <FileSpreadsheet className={clsx(cls, "text-emerald-600")} />;
  if (/\.(docx?|pages|txt|rtf)$/.test(name)) return <FileText className={clsx(cls, "text-blue-600")} />;
  if (/\.(zip|rar|7z)$/.test(name)) return <FileArchive className={clsx(cls, "text-amber-600")} />;
  return <File className={clsx(cls, "text-slate-500")} />;
}

export default function MaterialsPanel({
  courseCode,
  initialMaterials,
  aiEnabled,
}: {
  courseCode: string;
  initialMaterials: CourseMaterial[];
  aiEnabled: boolean;
}) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [tab, setTab] = useState<Tab>("all");
  const [kind, setKind] = useState<MaterialKind>("material");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ title: "", url: "", notes: "" });
  const [savingLink, setSavingLink] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<React.ReactNode>(null);
  const input = useRef<HTMLInputElement>(null);

  const counts = {
    all: materials.length,
    material: materials.filter((m) => m.kind !== "exercise").length,
    exercise: materials.filter((m) => m.kind === "exercise").length,
  };
  const shown = materials.filter((m) => tab === "all" || (tab === "exercise" ? m.kind === "exercise" : m.kind !== "exercise"));

  function selectTab(t: Tab) {
    setTab(t);
    if (t !== "all") setKind(t);
  }

  async function uploadOne(file: File, asKind: MaterialKind) {
    const id = `${file.name}-${file.size}-${Math.random()}`;
    const update = (patch: Partial<Upload>) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setUploads((u) => [...u, { id, name: file.name, size: file.size, progress: 0 }]);
    try {
      if (file.size > MAX_BYTES) throw new Error("Too big — files can be up to 50 MB.");
      const { signedUrl, path } = await api<{ signedUrl: string; path: string }>(`/api/courses/${courseCode}/materials/upload-url`, {
        body: { file_name: file.name, file_size: file.size },
      });
      await uploadWithProgress(signedUrl, file, (progress) => update({ progress }));
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || file.name;
      const { material } = await api<{ material: CourseMaterial }>(`/api/courses/${courseCode}/materials`, {
        body: { title, kind: asKind, file_path: path, file_name: file.name, file_size: file.size, mime_type: guessMime(file) },
      });
      setMaterials((ms) => [material, ...ms]);
      setUploads((u) => u.filter((x) => x.id !== id));
    } catch (err) {
      update({ error: (err as Error).message, progress: 0 });
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const asKind = kind;
    // Upload a few at a time so a big batch doesn't stall the connection.
    const files = Array.from(list);
    let next = 0;
    const worker = async () => {
      while (next < files.length) await uploadOne(files[next++], asKind);
    };
    void Promise.all([worker(), worker(), worker()]);
  }

  async function saveLink(e: React.FormEvent) {
    e.preventDefault();
    setSavingLink(true);
    setError(null);
    try {
      const { material } = await api<{ material: CourseMaterial }>(`/api/courses/${courseCode}/materials`, {
        body: { title: link.title, url: link.url || null, notes: link.notes || null, kind },
      });
      setMaterials((ms) => [material, ...ms]);
      setLink({ title: "", url: "", notes: "" });
      setLinkOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingLink(false);
    }
  }

  async function remove(m: CourseMaterial) {
    if (!confirm(`Delete "${m.title}"${m.file_path ? " and its file" : ""}?`)) return;
    const before = materials;
    setMaterials((ms) => ms.filter((x) => x.id !== m.id));
    try {
      await api(`/api/materials/${m.id}`, { method: "DELETE" });
    } catch (err) {
      setMaterials(before);
      setError((err as Error).message);
    }
  }

  async function switchKind(m: CourseMaterial) {
    const next: MaterialKind = m.kind === "exercise" ? "material" : "exercise";
    setBusyId(m.id);
    try {
      const { material } = await api<{ material: CourseMaterial }>(`/api/materials/${m.id}`, { method: "PATCH", body: { kind: next } });
      setMaterials((ms) => ms.map((x) => (x.id === m.id ? material : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function makeQuiz(m: CourseMaterial) {
    setBusyId(m.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ questions: unknown[]; message?: string }>(`/api/materials/${m.id}/quiz`, { body: {} });
      setNotice(
        res.questions.length ? (
          <>
            Added {res.questions.length} practice question{res.questions.length > 1 ? "s" : ""} from “{m.title}”.{" "}
            <Link href={`/practice?course=${courseCode}`} className="font-semibold underline">
              Practice now →
            </Link>
          </>
        ) : (
          (res.message ?? "No questions were found in that file.")
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <FolderOpen className="h-5 w-5 text-tu-600" /> Materials &amp; Exercises
        </h2>
        <div className="flex gap-1">
          {(["all", "material", "exercise"] as Tab[]).map((t) => (
            <button key={t} onClick={() => selectTab(t)} className={tab === t ? "chip-on" : "chip-off"}>
              {t === "all" ? "All" : t === "material" ? "Materials" : "Exercises"}
              <span className={clsx("rounded-full px-1.5 text-[10px]", tab === t ? "bg-white/20" : "bg-slate-100")}>{counts[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        Save new files as
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {(["material", "exercise"] as MaterialKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={clsx("rounded-md px-2.5 py-1 font-medium", kind === k ? "bg-tu-600 text-white" : "text-slate-600 hover:bg-slate-100")}
            >
              {k === "material" ? "Material" : "Exercise"}
            </button>
          ))}
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={clsx(
          "mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition",
          dragging ? "border-tu-500 bg-tu-50" : "border-slate-300 bg-slate-50 hover:border-tu-300 hover:bg-tu-50/40",
        )}
      >
        <UploadCloud className={clsx("h-6 w-6", dragging ? "text-tu-600" : "text-slate-400")} />
        <p className="text-sm font-medium text-slate-700">
          {dragging ? `Drop to save as ${kind === "exercise" ? "exercises" : "materials"}` : "Drop slides, readings or exercises here — or click to choose"}
        </p>
        <p className="text-xs text-slate-500">PDF, PowerPoint, Word, Excel, images, ZIP… · up to 50 MB each · several at once</p>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {uploads.map((u) => (
            <li key={u.id} className="rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {u.error ? <X className="h-4 w-4 shrink-0 text-red-500" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-tu-600" />}
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{u.error ? "" : `${u.progress}%`}</span>
                {u.error && (
                  <button onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))} className="text-xs text-slate-500 underline">
                    Dismiss
                  </button>
                )}
              </div>
              {u.error ? (
                <p className="mt-1 text-xs text-red-600">{u.error}</p>
              ) : (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-tu-600 transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Link instead of a file */}
      {linkOpen ? (
        <form onSubmit={saveLink} className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Title (e.g. Week 3 slides — Bond valuation)"
              value={link.title}
              onChange={(e) => setLink((l) => ({ ...l, title: e.target.value }))}
              autoFocus
            />
            <button type="button" onClick={() => setLinkOpen(false)} className="btn-ghost px-2" aria-label="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            className="input"
            placeholder="Link (Google Drive, OneDrive, Teams…) — optional"
            value={link.url}
            onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))}
          />
          <textarea
            className="input min-h-[60px]"
            placeholder="Notes — optional"
            value={link.notes}
            onChange={(e) => setLink((l) => ({ ...l, notes: e.target.value }))}
          />
          <button type="submit" className="btn-primary" disabled={savingLink || !link.title.trim()}>
            {savingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save {kind === "exercise" ? "exercise" : "material"}
          </button>
        </form>
      ) : (
        <button onClick={() => setLinkOpen(true)} className="mt-2 text-xs font-medium text-tu-700 hover:underline">
          + Add a link or note instead
        </button>
      )}

      {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* List */}
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {tab === "exercise"
            ? "No exercises yet. Drop exercise sheets or past papers above."
            : tab === "material"
              ? "No materials yet. Drop slides and readings above."
              : "Nothing saved yet. Drop your slides, readings and exercises above."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {shown.map((m) => {
            const canQuiz = aiEnabled && !!m.file_path && !!m.mime_type && AI_TYPES.includes(m.mime_type) && (m.file_size ?? 0) <= MAX_AI_BYTES;
            const busy = busyId === m.id;
            return (
              <li key={m.id} className="group py-2.5">
                <div className="flex items-start gap-3">
                  <FileIcon m={m} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.file_path ? (
                        <a
                          href={`/api/materials/${m.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-900 hover:text-tu-700 hover:underline"
                        >
                          {m.title}
                        </a>
                      ) : m.url ? (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-tu-700">
                          {m.title} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="font-medium text-slate-900">{m.title}</span>
                      )}
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          m.kind === "exercise" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {m.kind === "exercise" ? "Exercise" : "Material"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {[m.file_name, sizeLabel(m.file_size), formatDate(m.created_at)].filter(Boolean).join(" · ")}
                    </p>
                    {m.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{m.notes}</p>}
                    {(canQuiz && m.kind === "exercise") && (
                      <button onClick={() => makeQuiz(m)} disabled={busy} className="btn-secondary mt-2 px-2.5 py-1 text-xs">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5 text-tu-600" />}
                        {busy ? "Reading exercise…" : "Make practice quiz (AI)"}
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {m.file_path && (
                      <a
                        href={`/api/materials/${m.id}/file?download=1`}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Download ${m.title}`}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => switchKind(m)}
                      disabled={busy}
                      className="rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={m.kind === "exercise" ? "Move to materials" : "Move to exercises"}
                      title={m.kind === "exercise" ? "Move to materials" : "Move to exercises"}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(m)}
                      className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={`Delete ${m.title}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
