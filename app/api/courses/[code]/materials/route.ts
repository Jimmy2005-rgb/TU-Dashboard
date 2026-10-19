import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { CreateMaterialRequest } from "@/lib/schemas";
import { getOwnerId, getSupabaseAdmin, normalizeCourseCode } from "@/lib/supabase";
import type { CourseMaterial } from "@/lib/types";

/** POST /api/courses/:code/materials — save a link or note for a course. */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = normalizeCourseCode(params.code);
  if (!code) return jsonError("Invalid course code.");

  const parsed = await readJson(req, CreateMaterialRequest);
  if (parsed.error) return parsed.error;

  const { data, error } = await getSupabaseAdmin()
    .from("course_materials")
    .insert({
      user_id: getOwnerId(),
      course_code: code,
      title: parsed.data.title,
      url: parsed.data.url || null,
      notes: parsed.data.notes || null,
    })
    .select("*")
    .single<CourseMaterial>();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ material: data }, { status: 201 });
}
