import type { AiFile } from "@/lib/ai-shared";
import { tutorSystemPrompt } from "@/lib/ai-tasks";
import { aiProvider, streamChat } from "@/lib/ai";
import { MAX_ATTACHMENT_BYTES, MAX_REQUEST_ATTACHMENT_BYTES, attachmentMime, prepareAttachment } from "@/lib/attachments";
import { FILES_BUCKET, isOwnedPath } from "@/lib/files";
import { jsonError, readJson } from "@/lib/http";
import { TutorRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { Course, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/tutor
 * Body: { course_code, messages: [{ role, content, attachments?: [{ path, name, mime_type }] }] }
 * Attachments are files already uploaded to storage (chat uploads or course
 * materials). Streams a plain-text reply from a course-specific BBA tutor.
 */
export async function POST(req: Request) {
  const parsed = await readJson(req, TutorRequest);
  if (parsed.error) return parsed.error;

  const { messages } = parsed.data;
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") {
    return jsonError("Conversation must start and end with a user message.");
  }

  const courseCode = normalizeCourseCode(parsed.data.course_code);
  if (!courseCode) return jsonError("Invalid course code.");

  const db = getSupabaseAdmin();
  const [{ data: course }, { data: questions }] = await Promise.all([
    db.from("courses").select("*").eq("course_code", courseCode).maybeSingle<Course>(),
    db
      .from("quiz_bank")
      .select("question_text, tags")
      .eq("course_code", courseCode)
      .order("created_at", { ascending: true })
      .limit(15),
  ]);
  if (!course) return jsonError(`Course ${courseCode} not found.`, 404);

  // Load attachments newest-first so the latest ones always fit in the size budget.
  const provider = aiProvider() ?? "gemini";
  const owner = getOwnerId();
  let budget = MAX_REQUEST_ATTACHMENT_BYTES;
  const prepared: { role: "user" | "assistant"; content: string; files: AiFile[] }[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const isLatest = i === messages.length - 1;
    const files: AiFile[] = [];
    const notes: string[] = [];
    for (const a of m.attachments) {
      try {
        if (!isOwnedPath(a.path, owner, courseCode)) throw new Error(`${a.name}: file not found.`);
        const { data: blob, error } = await db.storage.from(FILES_BUCKET).download(a.path);
        if (error || !blob) throw new Error(`${a.name}: couldn't load the file. Try attaching it again.`);
        if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error(`${a.name}: too big for the tutor (15 MB max).`);
        if (blob.size > budget) {
          notes.push(`[Earlier attachment "${a.name}" not re-sent to save space.]`);
          continue;
        }
        const out = prepareAttachment(a.name, attachmentMime(a.name, a.mime_type || blob.type), new Uint8Array(await blob.arrayBuffer()), provider);
        budget -= blob.size;
        if (out.file) files.push(out.file);
        if (out.text) notes.push(out.text);
      } catch (err) {
        if (isLatest) return jsonError((err as Error).message, 415);
        notes.push(`[Attachment "${a.name}" couldn't be read.]`);
      }
    }
    const names = m.attachments.length ? `[Attached: ${m.attachments.map((a) => a.name).join(", ")}]\n` : "";
    prepared.unshift({ role: m.role, content: [names + m.content, ...notes].filter((x) => x.trim()).join("\n\n"), files });
  }

  const stream = streamChat({
    system: tutorSystemPrompt(course, (questions ?? []) as Pick<QuizQuestion, "question_text" | "tags">[]),
    messages: prepared,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
