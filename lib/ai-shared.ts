import type * as z from "zod";

/** Error with a user-facing message and the HTTP status the API route should return. */
export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export type Effort = "low" | "medium" | "high";

export interface ExtractOptions<S extends z.ZodType> {
  system: string;
  input: string;
  schema: S;
  effort?: Effort;
  maxTokens?: number;
}

export interface ChatOptions {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  effort?: Effort;
}

/** Current date/time in Bangkok, given to the model so it can resolve "next Friday". */
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
