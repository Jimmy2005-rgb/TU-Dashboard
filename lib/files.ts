import { randomUUID } from "node:crypto";

/** Private Supabase Storage bucket for uploaded course files (see migrations/003). */
export const FILES_BUCKET = "course-files";

/** Supabase Free plan maximum per file. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Files the AI can turn into practice questions (sent inline, so keep them small). */
export const AI_READABLE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
export const MAX_AI_FILE_BYTES = 15 * 1024 * 1024;

/** "Week 3 – Bond Valuation (final).pptx" → "Week-3-Bond-Valuation-final.pptx" */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^\w]/g, "").slice(0, 10).toLowerCase() : "";
  return `${base || "file"}${ext ? `.${ext}` : ""}`;
}

/** Storage path for a new upload: owner/COURSE/[folder/]uuid-name.ext */
export function newFilePath(ownerId: string, courseCode: string, fileName: string, folder?: string): string {
  return `${ownerId}/${courseCode}/${folder ? `${folder}/` : ""}${randomUUID()}-${safeFileName(fileName)}`;
}

/** Chat uploads for the AI tutor live in their own folder, so clearing a chat can remove them. */
export const TUTOR_FOLDER = "tutor";

/** Guard against saving a material that points at someone else's (or another course's) file. */
export function isOwnedPath(path: string, ownerId: string, courseCode: string): boolean {
  return path.startsWith(`${ownerId}/${courseCode}/`) && !path.includes("..");
}
