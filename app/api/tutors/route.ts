import { selectRows } from "@/db/supabase";
import { handleApiError, json, parseStringList } from "@/lib/api";

export const dynamic = "force-dynamic";
type ProfileRow = { user_id: string; subject: string; bio: string; bio_en: string | null; bio_zh: string | null; hourly_price: number; lesson_format: string; general_location: string | null; profile_photo_url: string | null; languages: unknown[] };

export async function GET(request: Request) {
  try {
    const subject = new URL(request.url).searchParams.get("subject")?.trim().slice(0, 60) ?? "";
    const profiles = await selectRows<ProfileRow>("tutor_profiles", { select: "user_id,subject,bio,bio_en,bio_zh,hourly_price,lesson_format,general_location,profile_photo_url,languages", is_published: "eq.true", subject: subject ? `ilike.*${subject.replace(/[*,()]/g, "")}*` : undefined, limit: 100 });
    const ids = profiles.map(row => row.user_id);
    const people = ids.length ? await selectRows<{ id: string; display_name: string }>("users", { select: "id,display_name", id: `in.(${ids.join(",")})` }) : [];
    const names = new Map(people.map(person => [person.id, person.display_name]));
    return json({ tutors: profiles.map(row => ({ id: row.user_id, displayName: names.get(row.user_id) ?? "Tutor", subject: row.subject, bio: row.bio, bioEn: row.bio_en, bioZh: row.bio_zh, hourlyPrice: row.hourly_price, lessonFormat: row.lesson_format, generalLocation: row.general_location, profilePhotoUrl: row.profile_photo_url, languages: parseStringList(row.languages) })) });
  } catch (error) { return handleApiError(error); }
}
