import type * as z from "zod";
import { AiError, type ChatOptions, type ExtractOptions } from "./ai-shared";
import { claudeExtract, claudeStreamText, describeClaudeError } from "./claude";
import { describeGeminiError, geminiExtract, geminiStreamText } from "./gemini";

export { AiError, bangkokNow } from "./ai-shared";

export type AiProvider = "claude" | "gemini";

/**
 * Which model powers the AI features. Claude (paid) wins when its key is set;
 * otherwise the free Gemini API is used. AI_PROVIDER forces one or the other.
 */
export function aiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER;
  if (forced === "claude" || forced === "gemini") return forced;
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "claude";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

function requireProvider(): AiProvider {
  const provider = aiProvider();
  if (!provider) {
    throw new AiError("AI isn't set up yet. Add GEMINI_API_KEY (free) in your Vercel environment variables.", 503);
  }
  return provider;
}

export async function extractStructured<S extends z.ZodType>(opts: ExtractOptions<S>): Promise<z.infer<S>> {
  return requireProvider() === "claude" ? claudeExtract(opts) : geminiExtract(opts);
}

/** Streams a tutor reply as plain UTF-8 text; errors are written into the stream. */
export function streamChat(opts: ChatOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chunks = requireProvider() === "claude" ? claudeStreamText(opts) : geminiStreamText(opts);
        for await (const text of chunks) controller.enqueue(encoder.encode(text));
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n_(Error: ${describeAiError(err)})_`));
      }
      controller.close();
    },
  });
}

function classify(err: unknown): { message: string; status: number } {
  if (err instanceof AiError) return { message: err.message, status: err.status };
  return (
    describeGeminiError(err) ??
    describeClaudeError(err) ??
    { message: err instanceof Error ? err.message : "Unknown error", status: 500 }
  );
}

/** Human-readable message for any error thrown while calling the AI. */
export function describeAiError(err: unknown): string {
  return classify(err).message;
}

export function aiErrorStatus(err: unknown): number {
  return classify(err).status;
}
