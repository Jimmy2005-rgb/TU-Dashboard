import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseAssignmentsWithAI } from "@/lib/ai-tasks";
import { describeAiError } from "@/lib/ai";
import { parseIncomingDate } from "@/lib/dates";
import { classCalendarForAi } from "@/lib/schedule";
import { loadSchedule } from "@/lib/schedule-data";
import { jsonError, readJson } from "@/lib/http";
import { WebhookPayload, type WebhookItem } from "@/lib/schemas";
import { ensureCourses, getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = req.headers.get("x-webhook-secret") ?? bearer ?? "";
  // Compare fixed-length digests so the check is constant-time.
  return timingSafeEqual(digest(provided), digest(secret));
}

type Row = {
  user_id: string;
  course_code: string | null;
  source_platform: "ms_teams" | "google_classroom";
  external_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  external_link: string | null;
};

async function itemToRows(item: WebhookItem, userId: string): Promise<{ rows: Row[]; courses: { course_code: string; name?: string | null }[] }> {
  const courseCode = normalizeCourseCode(item.course_code) ?? normalizeCourseCode(item.course_name);
  const link = item.external_link && /^https?:\/\//i.test(item.external_link) ? item.external_link : null;
  const base = {
    user_id: userId,
    source_platform: item.source_platform as Row["source_platform"],
  };

  // Structured payload: map fields directly.
  if (item.title) {
    return {
      rows: [
        {
          ...base,
          course_code: courseCode,
          external_id: item.external_id || null,
          title: item.title,
          description: item.description || null,
          due_date: parseIncomingDate(item.due_date),
          external_link: link,
        },
      ],
      courses: courseCode ? [{ course_code: courseCode, name: item.course_name?.replace(/^[A-Z]{2,4}\s*\d{3}\s*[-:]?\s*/i, "") || null }] : [],
    };
  }

  // Unstructured payload (e.g. a forwarded email body): let the AI extract tasks.
  const { slots, settings } = await loadSchedule();
  const parsed = await parseAssignmentsWithAI(item.raw_text ?? "", courseCode, [], [], classCalendarForAi(slots, settings, Date.now()));
  return {
    rows: parsed.assignments.map((a, i) => ({
      ...base,
      ...a,
      external_link: a.external_link ?? link,
      external_id: item.external_id ? (parsed.assignments.length > 1 ? `${item.external_id}#${i + 1}` : item.external_id) : null,
    })),
    courses: [...parsed.courses_detected, ...parsed.assignments.flatMap((a) => (a.course_code ? [{ course_code: a.course_code }] : []))],
  };
}

/**
 * POST /api/webhooks/incoming-assignment
 *
 * Called by Make.com / n8n when Microsoft Teams or Google Classroom posts new
 * work. Authenticate with the `x-webhook-secret: <WEBHOOK_SECRET>` header (or
 * `Authorization: Bearer <WEBHOOK_SECRET>`).
 *
 * Body: one item or { "assignments": [ ...items ] }, where an item is
 *   { source_platform, title, description?, due_date?, course_code?,
 *     course_name?, external_link?, external_id? }
 * or { source_platform, raw_text, external_id? } to have the AI parse it.
 *
 * Items with an external_id are upserted, so retries never create duplicates.
 */
export async function POST(req: Request) {
  if (!process.env.WEBHOOK_SECRET) return jsonError("Webhook is not configured (WEBHOOK_SECRET missing).", 503);
  if (!isAuthorized(req)) return jsonError("Unauthorized.", 401);

  const parsed = await readJson(req, WebhookPayload);
  if (parsed.error) return parsed.error;

  const items = parsed.data.assignments;
  const invalid = items.findIndex((i) => !i.title && !i.raw_text);
  if (invalid !== -1) return jsonError(`assignments.${invalid}: provide either "title" or "raw_text".`);

  const userId = getOwnerId();
  const rows: Row[] = [];
  const courses: { course_code: string; name?: string | null }[] = [];
  try {
    for (const item of items) {
      const result = await itemToRows(item, userId);
      rows.push(...result.rows);
      courses.push(...result.courses);
    }
  } catch (err) {
    console.error("[webhook] parse error", err);
    return jsonError(describeAiError(err), 502);
  }

  if (rows.length === 0) return NextResponse.json({ received: items.length, saved: 0, ids: [] });

  const db = getSupabaseAdmin();
  try {
    await ensureCourses(courses);

    const withId = rows.filter((r) => r.external_id);
    const withoutId = rows.filter((r) => !r.external_id);
    const ids: string[] = [];

    if (withId.length) {
      // De-duplicate within the batch: the last copy of an external_id wins.
      const unique = [...new Map(withId.map((r) => [`${r.source_platform}:${r.external_id}`, r])).values()];
      const { data, error } = await db
        .from("assignments")
        .upsert(unique, { onConflict: "user_id,source_platform,external_id" })
        .select("id");
      if (error) throw error;
      ids.push(...(data ?? []).map((d) => d.id as string));
    }
    if (withoutId.length) {
      const { data, error } = await db.from("assignments").insert(withoutId).select("id");
      if (error) throw error;
      ids.push(...(data ?? []).map((d) => d.id as string));
    }

    return NextResponse.json({ received: items.length, saved: ids.length, ids }, { status: 201 });
  } catch (err) {
    console.error("[webhook] DB error", err);
    return jsonError(`Saving failed: ${err instanceof Error ? err.message : "database error"}`, 500);
  }
}

/** GET lets you check the endpoint is reachable from Make.com / n8n. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return jsonError("Unauthorized.", 401);
  return NextResponse.json({ ok: true, endpoint: "incoming-assignment" });
}
