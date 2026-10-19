import { NextResponse } from "next/server";
import type * as z from "zod";

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

/** Parse and validate a JSON request body; returns either data or a ready 400 response. */
export async function readJson<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S>; error?: never } | { data?: never; error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: jsonError("Request body must be valid JSON.") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return { error: jsonError(`${where}${first?.message ?? "Invalid request"}`, 400, result.error.issues) };
  }
  return { data: result.data };
}
