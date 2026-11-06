import { selectRows } from "@/db/supabase";
import { ApiError, handleApiError, json, parseStringList } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const profile = (await selectRows<Record<string, unknown>>("tutor_profiles", { select: "*", user_id: `eq.${id}`, is_published: "eq.true", limit: 1 }))[0];
    if (!profile) throw new ApiError(404, "Tutor not found");
    const person = (await selectRows<{ display_name: string }>("users", { select: "display_name", id: `eq.${id}`, limit: 1 }))[0];
    const booked = await selectRows<{ slot_id: string }>("bookings", { select: "slot_id", tutor_id: `eq.${id}` });
    const bookedIds = new Set(booked.map(row => row.slot_id));
    const slotRows = await selectRows<{ id: string; starts_at: string; ends_at: string }>("availability_slots", { select: "id,starts_at,ends_at", tutor_id: `eq.${id}`, starts_at: `gt.${new Date().toISOString()}`, order: "starts_at.asc", limit: 100 });
    const slots = slotRows.filter(slot => !bookedIds.has(slot.id)).slice(0, 50).map(slot => ({ id: slot.id, startsAt: slot.starts_at, endsAt: slot.ends_at }));
    return json({ tutor: { id, displayName: person?.display_name ?? "Tutor", subject: profile.subject, subjects: parseStringList((profile.subjects as unknown[]) ?? [profile.subject]), bio: profile.bio, bioEn: profile.bio_en, bioZh: profile.bio_zh, hourlyPrice: profile.hourly_price, lessonFormat: profile.lesson_format, generalLocation: profile.general_location, profilePhotoUrl: profile.profile_photo_url, languages: parseStringList(profile.languages as unknown[]) }, slots });
  } catch (error) { return handleApiError(error); }
}
