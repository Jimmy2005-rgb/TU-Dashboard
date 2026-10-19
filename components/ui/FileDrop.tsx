"use client";

import clsx from "clsx";
import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,application/pdf,image/*";
const MAX_BYTES = 4 * 1024 * 1024; // matches the server limit
const MAX_FILES = 5;

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Drag-and-drop (or click to choose) area for PDFs and photos sent to the AI. */
export default function FileDrop({
  files,
  onChange,
  disabled,
  hint = "PDF, photo or screenshot",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const incoming = Array.from(list).filter((f) => f.type === "application/pdf" || f.type.startsWith("image/") || /\.(pdf|heic|heif)$/i.test(f.name));
    if (incoming.length < list.length) setError("Only PDFs and images can be read.");
    const next = [...files, ...incoming].slice(0, MAX_FILES);
    const total = next.reduce((n, f) => n + f.size, 0);
    if (total > MAX_BYTES) {
      setError(`Too big: ${sizeLabel(total)} (4 MB max). Try fewer pages or a smaller photo.`);
      return;
    }
    onChange(next);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center transition",
          dragging ? "border-tu-500 bg-tu-50" : "border-slate-300 bg-slate-50 hover:border-tu-300 hover:bg-tu-50/40",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <UploadCloud className={clsx("h-6 w-6", dragging ? "text-tu-600" : "text-slate-400")} />
        <p className="text-sm font-medium text-slate-700">
          {dragging ? "Drop to attach" : "Drop files here or click to choose"}
        </p>
        <p className="text-xs text-slate-500">{hint} · up to 4 MB</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
              {f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? (
                <FileText className="h-4 w-4 shrink-0 text-tu-600" />
              ) : (
                <ImageIcon className="h-4 w-4 shrink-0 text-indigo-500" />
              )}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{sizeLabel(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={`Remove ${f.name}`}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
