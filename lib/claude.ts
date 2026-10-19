import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod";

/**
 * Claude Sonnet 3.5 was retired in Oct 2025, so we default to the current
 * Sonnet. Override with CLAUDE_MODEL if you want a different model.
 */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

// If Claude's safety classifiers decline a (benign) request, the API retries it
// server-side on Anthropic's recommended fallback model instead of failing.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

export class ClaudeError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/** Current date/time in Bangkok, given to Claude so it can resolve "next Friday". */
export function bangkokNow(): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return `${date} (Asia/Bangkok, UTC+07:00)`;
}

/**
 * One-shot structured extraction: Claude reads `input` and returns JSON that is
 * guaranteed to match `schema` (structured outputs), parsed and typed.
 */
export async function extractStructured<S extends z.ZodType>(opts: {
  system: string;
  input: string;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const response = await getClaude().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.input }],
    output_config: {
      effort: opts.effort ?? "medium",
      format: betaZodOutputFormat(opts.schema),
    },
  });

  if (response.stop_reason === "refusal") {
    throw new ClaudeError("Claude declined to process this text. Try rephrasing or trimming it.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ClaudeError("The text is too long to process in one go. Split it into smaller parts.", 413);
  }
  if (response.parsed_output == null) {
    throw new ClaudeError("Claude returned an empty result.");
  }
  return response.parsed_output as z.infer<S>;
}

/**
 * Streams a tutor-style chat reply as plain text. Thinking blocks and other
 * non-text content are dropped; only the visible answer reaches the browser.
 */
export function streamChat(opts: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort?: "low" | "medium" | "high";
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = getClaude().beta.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          // The system prompt is stable per course, so cache it across turns.
          system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
          messages: opts.messages,
          output_config: { effort: opts.effort ?? "medium" },
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_(The tutor couldn't answer that one. Try rephrasing.)_"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n_(Answer truncated — ask me to continue.)_"));
        }
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n_(Error: ${describeClaudeError(err)})_`));
        controller.close();
      }
    },
  });
}

/** Human-readable message for an error thrown by the Anthropic SDK. */
export function describeClaudeError(err: unknown): string {
  if (err instanceof ClaudeError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "Invalid ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "Claude rate limit hit — wait a moment and retry.";
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status ?? "network"}).`;
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export function claudeErrorStatus(err: unknown): number {
  if (err instanceof ClaudeError) return err.status;
  if (err instanceof Anthropic.RateLimitError) return 429;
  if (err instanceof Anthropic.APIError) return 502;
  return 500;
}
