import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { CreateGradeItemRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin } from "@/lib/supabase";
import type { GradeItem } from "@/lib/types";

/** POST /api/grades/items — record a result, e.g. "Midterm" 42 / 60. */
export async function POST(req: Request) {
  const parsed = await readJson(req, CreateGradeItemRequest);
  if (parsed.error) return parsed.error;
  const item = parsed.data;
  const db = getSupabaseAdmin();
  const userId = getOwnerId();

  const { data: component } = await db
    .from("grade_components")
    .select("id")
    .eq("id", item.component_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!component) return jsonError("Grade part not found.", 404);

  const { data, error } = await db
    .from("grade_items")
    .insert({
      user_id: userId,
      component_id: item.component_id,
      title: item.title,
      score: item.score,
      max_score: item.max_score,
      taken_on: item.taken_on || null,
      notes: item.notes || null,
    })
    .select("*")
    .single<GradeItem>();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ item: data }, { status: 201 });
}
