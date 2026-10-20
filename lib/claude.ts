import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod";
import { AiError, type AiFile, type ChatOptions, type ExtractOptions } from "./ai-shared";

/**
 * Optional paid provider. Used instead of Gemini when ANTHROPIC_API_KEY is set.
 * Claude Sonnet 3.5 was retired in Oct 2025, so we default to the current
 * Sonnet. Override with CLAUDE_MODEL if you want a different model.
 */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

// If Claude's safety classifiers decline a (benign) request, the API retries it
// server-side on Anthropic's recommended fallback model instead of failing.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;

function getClaude(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AiError("ANTHROPIC_API_KEY is not set.", 503);
  client = new Anthropic({ apiKey, maxRetries: 2 });
  return client;
}

const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ClaudeImageType = (typeof CLAUDE_IMAGE_TYPES)[number];

/** PDFs become document blocks and photos image blocks, placed before the text. */
function toClaudeContent(input: string, files: AiFile[] = []): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = files.map((f) => {
    if (f.mimeType === "application/pdf") {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } };
    }
    if (!CLAUDE_IMAGE_TYPES.includes(f.mimeType as ClaudeImageType)) {
      throw new AiError(`${f.name}: Claude can't read this file type. Use PDF, JPG, PNG or WebP.`, 415);
    }
    return { type: "image", source: { type: "base64", media_type: f.mimeType as ClaudeImageType, data: f.data } };
  });
  return [...blocks, { type: "text", text: input }];
}

/** Structured extraction: Claude returns JSON guaranteed to match `schema`. */
export async function claudeExtract<S extends z.ZodType>(opts: ExtractOptions<S>): Promise<z.infer<S>> {
  const response = await getClaude().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.files?.length ? toClaudeContent(opts.input, opts.files) : opts.input }],
    output_config: {
      effort: opts.effort ?? "medium",
      format: betaZodOutputFormat(opts.schema),
    },
  });

  if (response.stop_reason === "refusal") {
    throw new AiError("The AI declined to process this text. Try rephrasing or trimming it.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AiError("The text is too long to process in one go. Split it into smaller parts.", 413);
  }
  if (response.parsed_output == null) throw new AiError("The AI returned an empty result.");
  return response.parsed_output as z.infer<S>;
}

/** Yields the visible text of a tutor reply; thinking blocks are dropped. */
export async function* claudeStreamText(opts: ChatOptions): AsyncGenerator<string> {
  const stream = getClaude().beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    // The system prompt is stable per course, so cache it across turns.
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: opts.messages.map((m) =>
      m.files?.length ? { role: m.role, content: toClaudeContent(m.content || "(see attachment)", m.files) } : { role: m.role, content: m.content },
    ),
    output_config: { effort: opts.effort ?? "medium" },
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield "\n\n_(The tutor couldn't answer that one. Try rephrasing.)_";
  else if (final.stop_reason === "max_tokens") yield "\n\n_(Answer truncated — ask me to continue.)_";
}

/** Human-readable message for an Anthropic SDK error, or null if it isn't one. */
export function describeClaudeError(err: unknown): { message: string; status: number } | null {
  if (err instanceof Anthropic.AuthenticationError) return { message: "Invalid ANTHROPIC_API_KEY.", status: 502 };
  if (err instanceof Anthropic.RateLimitError) return { message: "Claude rate limit hit — wait a moment and retry.", status: 429 };
  if (err instanceof Anthropic.BadRequestError) return { message: `Claude rejected the request: ${err.message}`, status: 502 };
  if (err instanceof Anthropic.APIError) return { message: `Claude API error (${err.status ?? "network"}).`, status: 502 };
  return null;
}
