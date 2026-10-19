import { NextResponse } from "next/server";
import * as z from "zod";
import { SESSION_COOKIE, SESSION_MAX_AGE, expectedSessionToken, isAuthEnabled, safeEqual } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

export async function POST(req: Request) {
  if (!isAuthEnabled()) return NextResponse.json({ ok: true });

  const parsed = await readJson(req, z.object({ password: z.string().min(1).max(500) }));
  if (parsed.error) return parsed.error;

  const ok = await safeEqual(parsed.data.password, process.env.APP_PASSWORD ?? "");
  if (!ok) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return jsonError("Wrong password.", 401);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await expectedSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
