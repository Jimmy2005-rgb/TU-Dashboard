import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";
import * as z from "zod";
import { AiError, type ChatOptions, type ExtractOptions } from "./ai-shared";

/**
 * Default (free) provider: Google Gemini. `gemini-3.8-flash` is on the Gemini
 * API free tier; override with GEMINI_MODEL (e.g. "gemini-3.5-flash-lite" for
 * higher free-tier limits).
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * Free-tier backups tried in order when the main model is busy (503 "high
 * demand") or rate-limited. Override with GEMINI_FALLBACK_MODELS="a,b".
 */
const GEMINI_MODELS = Array.from(
  new Set(
    [GEMINI_MODEL, ...(process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash-lite,gemini-2.5-flash").split(",")]
      .map((m) => m.trim())
      .filter(Boolean),
  ),
);

/** Errors worth retrying on another model: busy, rate-limited, or a transient server fault. */
function isTransient(err: unknown): boolean {
  return err instanceof ApiError && [429, 500, 502, 503, 504].includes(err.status);
}

/** Runs `call` on each model in turn until one succeeds or a non-transient error occurs. */
async function withModelFallback<T>(call: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const [i, model] of GEMINI_MODELS.entries()) {
    try {
      return await call(model);
    } catch (err) {
      if (!isTransient(err)) throw err;
      lastError = err;
      console.warn(`[gemini] ${model} unavailable (${(err as ApiError).status}); trying next model`);
      if (i < GEMINI_MODELS.length - 1) await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastError;
}

let client: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (client) return client;
  // Trim: a key pasted into Vercel with a stray space or line break is rejected by Google.
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiError("GEMINI_API_KEY is not set.", 503);
  client = new GoogleGenAI({ apiKey });
  return client;
}

/** Zod → JSON Schema in the subset Gemini accepts (it rejects the `$schema` keyword). */
function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

function toContents(messages: ChatOptions["messages"]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [...(m.files ?? []).map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })), { text: m.content || "(see attachment)" }],
  }));
}

/** Structured extraction: Gemini returns JSON constrained to `schema`, validated again with Zod. */
export async function geminiExtract<S extends z.ZodType>(opts: ExtractOptions<S>): Promise<z.infer<S>> {
  const fileParts = (opts.files ?? []).map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } }));
  const contents = fileParts.length ? [{ role: "user", parts: [...fileParts, { text: opts.input }] }] : opts.input;
  const responseJsonSchema = toGeminiSchema(opts.schema);
  const response = await withModelFallback((model) =>
    getGemini().models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        responseJsonSchema,
        maxOutputTokens: opts.maxTokens ?? 32000,
      },
    }),
  );

  const finish = response.candidates?.[0]?.finishReason;
  if (finish === FinishReason.SAFETY || finish === FinishReason.RECITATION || response.promptFeedback?.blockReason) {
    throw new AiError("The AI declined to process this text. Try rephrasing or trimming it.", 422);
  }
  if (finish === FinishReason.MAX_TOKENS) {
    throw new AiError("The text is too long to process in one go. Split it into smaller parts.", 413);
  }

  const text = response.text;
  if (!text) throw new AiError("The AI returned an empty result.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AiError("The AI returned malformed JSON. Please try again.");
  }
  const parsed = opts.schema.safeParse(data);
  if (!parsed.success) throw new AiError("The AI's answer didn't match the expected format. Please try again.");
  return parsed.data;
}

const THINKING = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH } as const;

/** Yields a tutor reply as it is generated. */
export async function* geminiStreamText(opts: ChatOptions): AsyncGenerator<string> {
  const contents = toContents(opts.messages);
  const config = (model: string) => ({
    systemInstruction: opts.system,
    // Gemini 3 thinks at "high" by default; a tutor reply should start quickly.
    // Older fallback models keep their default.
    ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: THINKING[opts.effort ?? "low"] } } : {}),
  });

  // With photos/files in the conversation, Gemini's streaming endpoint was taking
  // 100+ s (vs ~4 s for the same request unstreamed), so ask for the whole answer.
  const hasFiles = opts.messages.some((m) => m.files?.length);
  let finish: FinishReason | undefined;
  if (hasFiles) {
    const response = await withModelFallback((model) => getGemini().models.generateContent({ model, contents, config: config(model) }));
    if (response.text) yield response.text;
    finish = response.candidates?.[0]?.finishReason;
  } else {
    // Fallback applies to starting the reply; a failure mid-stream is reported as-is.
    const stream = await withModelFallback((model) => getGemini().models.generateContentStream({ model, contents, config: config(model) }));
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
      finish = chunk.candidates?.[0]?.finishReason ?? finish;
    }
  }

  if (finish === FinishReason.SAFETY || finish === FinishReason.RECITATION) {
    yield "\n\n_(The tutor couldn't answer that one. Try rephrasing.)_";
  } else if (finish === FinishReason.MAX_TOKENS) {
    yield "\n\n_(Answer truncated — ask me to continue.)_";
  }
}

/** Human-readable message for a Gemini SDK error, or null if it isn't one. */
export function describeGeminiError(err: unknown): { message: string; status: number } | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status === 429) {
    return { message: "Free Gemini limit reached — wait a minute and try again.", status: 429 };
  }
  if ([500, 502, 503, 504].includes(err.status)) {
    return { message: "Google's free Gemini models are busy right now. Wait a minute and try again.", status: 503 };
  }
  if (err.status === 400 && /api key/i.test(err.message)) {
    return { message: "Google rejected the Gemini key (API key not valid). Re-copy it from AI Studio into GEMINI_API_KEY in Vercel, then redeploy.", status: 502 };
  }
  if (err.status === 401 || err.status === 403) return { message: "Invalid GEMINI_API_KEY.", status: 502 };
  if (err.status === 404) return { message: `Gemini model "${GEMINI_MODEL}" not found. Set GEMINI_MODEL.`, status: 502 };
  return { message: `Gemini API error (${err.status}).`, status: 502 };
}
