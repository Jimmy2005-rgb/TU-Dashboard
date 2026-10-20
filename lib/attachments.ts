import { strFromU8, unzipSync } from "fflate";
import type { AiFile } from "./ai-shared";
import { attachmentKind } from "./attachment-types";

export { MAX_ATTACHMENT_BYTES, MAX_REQUEST_ATTACHMENT_BYTES, attachmentKind, attachmentMime } from "./attachment-types";

/**
 * Chat attachments: what the tutor can read and how.
 * - Sent to the model as files: images, PDFs, audio (voice notes), short videos.
 * - Turned into text first: plain text / CSV / code, and Word, PowerPoint, Excel.
 */

/** Gemini's names for a few audio types. */
function geminiAudioMime(mime: string): string {
  if (mime === "audio/mpeg") return "audio/mp3";
  if (mime === "audio/x-wav" || mime === "audio/wave") return "audio/wav";
  return mime;
}

const MAX_TEXT_CHARS = 60_000;

/**
 * Turn one downloaded attachment into either a file for the model or text for the prompt.
 * Throws a readable error for types this provider can't use.
 */
export function prepareAttachment(
  name: string,
  mime: string,
  bytes: Uint8Array,
  provider: "claude" | "gemini",
): { file?: AiFile; text?: string } {
  const kind = attachmentKind(mime);
  if (!kind) throw new Error(`${name}: this file type can't be read. Try PDF, a photo, a voice note, or a Word/PowerPoint/Excel file.`);

  if (kind === "text") return { text: wrap(name, clip(new TextDecoder().decode(bytes))) };
  if (kind === "office") return { text: wrap(name, clip(officeToText(name, bytes))) };

  if (provider === "claude" && (kind === "audio" || kind === "video")) {
    throw new Error(`${name}: voice notes and videos need the Gemini AI. Type your question instead, or switch the AI to Gemini.`);
  }
  if (provider === "claude" && kind === "image" && !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) {
    throw new Error(`${name}: convert this photo to JPG or PNG first.`);
  }
  const data = Buffer.from(bytes).toString("base64");
  return { file: { name, mimeType: kind === "audio" ? geminiAudioMime(mime) : mime, data } };
}

function wrap(name: string, text: string): string {
  return `<attached_file name="${name.replace(/"/g, "'")}">\n${text.trim() || "(empty)"}\n</attached_file>`;
}

function clip(text: string): string {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n…(file cut off here — it's very long)` : text;
}

// ─── Word / PowerPoint / Excel → text ─────────────────────────────────────

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function textRuns(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => decodeXml(m[1]));
}

function officeToText(name: string, bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error(`${name}: couldn't open this file. If it's an old .doc/.ppt/.xls, save it as .docx/.pptx/.xlsx or PDF.`);
  }
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : "");
  const ext = name.toLowerCase().split(".").pop();

  if (ext === "docx") {
    return read("word/document.xml")
      .split(/<\/w:p>/)
      .map((p) => textRuns(p, "w:t").join(""))
      .filter((line) => line.trim())
      .join("\n");
  }

  if (ext === "pptx") {
    const slides = Object.keys(files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    return slides
      .map((p, i) => {
        const paras = read(p).split(/<\/a:p>/).map((para) => textRuns(para, "a:t").join("")).filter((t) => t.trim());
        const notesPath = `ppt/notesSlides/notesSlide${p.match(/\d+/)![0]}.xml`;
        const notes = read(notesPath).split(/<\/a:p>/).map((para) => textRuns(para, "a:t").join("")).filter((t) => t.trim() && !/^\d+$/.test(t.trim()));
        return `--- Slide ${i + 1} ---\n${paras.join("\n")}${notes.length ? `\n(Speaker notes: ${notes.join(" ")})` : ""}`;
      })
      .join("\n\n");
  }

  if (ext === "xlsx") {
    const shared = read("xl/sharedStrings.xml")
      .split(/<\/si>/)
      .map((si) => textRuns(si, "t").join(""));
    const workbook = read("xl/workbook.xml");
    const names = [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => decodeXml(m[1]));
    const sheets = Object.keys(files)
      .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    return sheets
      .map((p, i) => {
        const rows = read(p)
          .split(/<\/row>/)
          .map((row) =>
            [...row.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
              .map(([, attrs, inner = ""]) => {
                const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
                const inline = textRuns(inner, "t").join("");
                if (/t="s"/.test(attrs) && v != null) return shared[Number(v)] ?? "";
                return inline || (v != null ? decodeXml(v) : "");
              })
              .join("\t"),
          )
          .filter((r) => r.trim());
        return `--- Sheet: ${names[i] ?? i + 1} ---\n${rows.join("\n")}`;
      })
      .join("\n\n");
  }

  throw new Error(`${name}: only .docx, .pptx and .xlsx Office files can be read.`);
}
