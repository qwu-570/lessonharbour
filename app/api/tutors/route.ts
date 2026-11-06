import { selectRows } from "@/db/supabase";
import { handleApiError, json, parseStringList } from "@/lib/api";

export const dynamic = "force-dynamic";
type ProfileRow = { user_id: string; subject: string; subjects: unknown[]; bio: string; bio_en: string | null; bio_zh: string | null; hourly_price: number; lesson_format: string; general_location: string | null; postcode: string | null; profile_photo_url: string | null; languages: unknown[] };

const postcodeAreas: Record<string, string[]> = {
  london: ["E", "EC", "N", "NW", "SE", "SW", "W", "WC"], surrey: ["CR", "GU", "KT", "RH", "SM", "TW"], kent: ["BR", "CT", "DA", "ME", "TN"], sussex: ["BN", "GU", "PO", "RH", "TN"], hampshire: ["GU", "PO", "RG", "SO", "SP"], oxford: ["OX"], cambridge: ["CB"], birmingham: ["B"], manchester: ["M", "OL", "SK", "WA", "WN"], edinburgh: ["EH"],
};

function rank(row: ProfileRow, location: string) {
  const wanted = location.toLowerCase();
  if (wanted === "online") return row.lesson_format === "online" || row.lesson_format === "both" ? 0 : 3;
  const publicLocation = row.general_location?.toLowerCase() ?? "";
  if (publicLocation.includes(wanted) || wanted.includes(publicLocation) && publicLocation.length > 2) return 0;
  const outwardArea = row.postcode?.toUpperCase().match(/^[A-Z]+/)?.[0] ?? "";
  if ((postcodeAreas[wanted] ?? []).includes(outwardArea)) return 1;
  if (row.lesson_format === "both" || row.lesson_format === "online") return 2;
  return 3;
}

export async function GET(request: Request) {
  try {
    const subject = new URL(request.url).searchParams.get("subject")?.trim().slice(0, 60) ?? "";
    const requestedLocation = new URL(request.url).searchParams.get("location")?.trim().slice(0, 60);
    const location = requestedLocation || request.headers.get("cf-ipcity") || request.headers.get("x-lessonharbour-visitor-city") || "London";
    const allProfiles = await selectRows<ProfileRow>("tutor_profiles", { select: "user_id,subject,subjects,bio,bio_en,bio_zh,hourly_price,lesson_format,general_location,postcode,profile_photo_url,languages", is_published: "eq.true", limit: 200 });
    const matchingProfiles = subject ? allProfiles.filter(row => parseStringList(row.subjects).some(item => item.toLowerCase().includes(subject.toLowerCase()))) : allProfiles;
    const profiles = matchingProfiles.map((row, index) => ({ row, index, score: rank(row, location) })).sort((a, b) => a.score - b.score || a.index - b.index).map(item => item.row);
    const ids = profiles.map(row => row.user_id);
    const people = ids.length ? await selectRows<{ id: string; display_name: string }>("users", { select: "id,display_name", id: `in.(${ids.join(",")})` }) : [];
    const names = new Map(people.map(person => [person.id, person.display_name]));
    return json({ tutors: profiles.slice(0, 100).map(row => ({ id: row.user_id, displayName: names.get(row.user_id) ?? "Tutor", subject: row.subject, subjects: parseStringList(row.subjects), bio: row.bio, bioEn: row.bio_en, bioZh: row.bio_zh, hourlyPrice: row.hourly_price, lessonFormat: row.lesson_format, generalLocation: row.general_location, profilePhotoUrl: row.profile_photo_url, languages: parseStringList(row.languages) })) });
  } catch (error) { return handleApiError(error); }
}
