import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { CreateComponentsRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { GradeComponent } from "@/lib/types";

type Ctx = { params: { code: string } };

/**
 * POST /api/courses/:code/grades
 * Body: { components: [{ name, weight, description? }], replace? }
 * Adds graded parts (e.g. "Midterm" 30%) to a course. With replace=true the
 * course's existing parts and their scores are removed first.
 */
export async function POST(req: Request, { params }: Ctx) {
  const code = normalizeCourseCode(params.code);
  if (!code) return jsonError("Invalid course code.");

  const parsed = await readJson(req, CreateComponentsRequest);
  if (parsed.error) return parsed.error;
  const { components, replace } = parsed.data;

  const db = getSupabaseAdmin();
  const userId = getOwnerId();

  if (replace) {
    const { error } = await db.from("grade_components").delete().eq("user_id", userId).eq("course_code", code);
    if (error) return jsonError(error.message, 500);
  }

  const { count } = await db
    .from("grade_components")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("course_code", code);

  const { data, error } = await db
    .from("grade_components")
    .insert(
      components.map((c, i) => ({
        user_id: userId,
        course_code: code,
        name: c.name,
        weight: c.weight,
        description: c.description || null,
        sort_order: (count ?? 0) + i,
      })),
    )
    .select("*");
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ components: data as GradeComponent[] }, { status: 201 });
}
