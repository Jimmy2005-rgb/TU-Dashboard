import type * as z from "zod";
import type { AiFile } from "./ai-shared";
import { jsonError } from "./http";

/** File types the AI can read: PDFs and photos/screenshots. */
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Vercel rejects request bodies over 4.5 MB, so keep uploads safely below that. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 5;

/**
 * Reads a request that is either JSON or multipart/form-data (text fields +
 * `files`), validates the fields with `schema`, and returns any files as base64.
 */
export async function readAiRequest<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S>; files: AiFile[]; error?: never } | { data?: never; files?: never; error: Response }> {
  const type = req.headers.get("content-type") ?? "";
  let fields: Record<string, unknown> = {};
  const files: AiFile[] = [];

  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      let total = 0;
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") {
          fields[key] = value;
          continue;
        }
        if (key !== "files" || value.size === 0) continue;
        if (files.length >= MAX_FILES) return { error: jsonError(`Up to ${MAX_FILES} files at a time.`, 413) };
        const mimeType = value.type || guessType(value.name);
        if (!(ACCEPTED_FILE_TYPES as readonly string[]).includes(mimeType)) {
          return { error: jsonError(`${value.name}: only PDF and image files (JPG, PNG, WebP, HEIC) are supported.`, 415) };
        }
        total += value.size;
        if (total > MAX_UPLOAD_BYTES) {
          return { error: jsonError("Files are too big (4 MB total max). Try fewer pages or a smaller photo.", 413) };
        }
        files.push({ name: value.name, mimeType, data: Buffer.from(await value.arrayBuffer()).toString("base64") });
      }
    } else {
      fields = (await req.json()) as Record<string, unknown>;
    }
  } catch {
    return { error: jsonError("Couldn't read the request. If you attached files, make sure they're under 4 MB.", 400) };
  }

  const result = schema.safeParse(fields);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return { error: jsonError(`${where}${first?.message ?? "Invalid request"}`, 400, result.error.issues) };
  }
  return { data: result.data, files };
}

function guessType(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}
