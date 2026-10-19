import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 *
 * The service role bypasses Row Level Security, so this module must only be
 * imported from Server Components, Route Handlers and Server Actions — never
 * from a "use client" file. All tables have RLS enabled with no anon access,
 * so the public anon key cannot read anything even if it leaks.
 */
let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "tu-bba-academic-hub" } },
  });
  return admin;
}

/** The single owner of this personal hub. Every user-scoped row uses this id. */
export function getOwnerId(): string {
  return process.env.OWNER_USER_ID || "00000000-0000-0000-0000-000000000001";
}

/**
 * Normalise a course code: " fn 201 " → "FN201", and pull the code out of
 * labels like "FN201 Business Finance (Sec 650001)" → "FN201".
 */
export function normalizeCourseCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{2,4}[0-9]{3}$/.test(cleaned)) return cleaned;
  const match = /(?:^|[^A-Z])([A-Z]{2,4})\s*-?\s*([0-9]{3})(?![0-9])/.exec(upper);
  return match ? `${match[1]}${match[2]}` : null;
}

/**
 * Make sure each course code exists in `courses` so foreign keys hold.
 * Existing rows are left untouched; new ones get a placeholder name.
 */
export async function ensureCourses(
  courses: Array<{ course_code: string; name?: string | null; professor?: string | null }>,
): Promise<void> {
  const unique = new Map<string, { course_code: string; name: string; professor: string | null }>();
  for (const c of courses) {
    const code = normalizeCourseCode(c.course_code);
    if (!code || unique.has(code)) continue;
    unique.set(code, { course_code: code, name: c.name?.trim() || code, professor: c.professor ?? null });
  }
  if (unique.size === 0) return;

  const { error } = await getSupabaseAdmin()
    .from("courses")
    .upsert([...unique.values()], { onConflict: "course_code", ignoreDuplicates: true });
  if (error) throw new Error(`Failed to register courses: ${error.message}`);
}
