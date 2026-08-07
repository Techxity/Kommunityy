// Server-only slug helpers for giving each community its own bookmarkable
// login URL at /l/{slug} (see src/routes/l.$slug.tsx).
import { sql } from "@/lib/db/client";

export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);
  return base || "estate";
}

// Generates a unique, readable slug for a community from its name —
// "Irewole Estate" -> "irewole-estate", falling back to "-2", "-3", etc. on
// collision so every estate gets its own login URL.
export async function uniqueCommunitySlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  // Capped so a pathological run of collisions can't loop forever — falls
  // back to a short random suffix instead.
  while (n < 50) {
    const rows = await sql`SELECT 1 FROM public.communities WHERE slug = ${candidate} LIMIT 1`;
    if (!rows[0]) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
