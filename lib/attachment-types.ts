/** File types the AI tutor accepts (shared by the browser and the server). */

export type AttachmentKind = "image" | "pdf" | "audio" | "video" | "text" | "office";

const BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf",
  wav: "audio/wav", mp3: "audio/mp3", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", webm: "audio/webm", opus: "audio/ogg",
  mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", tsv: "text/tab-separated-values", json: "application/json",
  html: "text/html", xml: "text/xml", py: "text/x-python", js: "text/javascript", ts: "text/plain", sql: "text/plain", r: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Biggest file sent to the AI, and the most attachment bytes sent in one request. */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_REQUEST_ATTACHMENT_BYTES = 18 * 1024 * 1024;

export function attachmentMime(name: string, given?: string | null): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (given && given !== "application/octet-stream") return given.split(";")[0];
  return BY_EXT[ext] ?? "application/octet-stream";
}

export function attachmentKind(mime: string): AttachmentKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  if (mime.includes("officedocument")) return "office";
  return null;
}
