import { selectRows, updateRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, requireAccount } from "@/lib/api";

export const dynamic = "force-dynamic";
function icsEscape(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function icsDate(value: string) { return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? ""; if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(404, "Calendar not found");
    const profile = (await selectRows<{ user_id: string; subject: string; subjects: unknown[] }>("tutor_profiles", { select: "user_id,subject,subjects", calendar_feed_token: `eq.${token}`, limit: 1 }))[0]; if (!profile) throw new ApiError(404, "Calendar not found");
    const bookings = await selectRows<{ id: string; slot_id: string }>("bookings", { select: "id,slot_id", tutor_id: `eq.${profile.user_id}`, status: "eq.accepted" });
    const slotIds = bookings.map(row => row.slot_id); const slots = slotIds.length ? await selectRows<{ id: string; starts_at: string; ends_at: string }>("availability_slots", { select: "id,starts_at,ends_at", id: `in.(${slotIds.join(",")})` }) : []; const slotMap = new Map(slots.map(row => [row.id, row]));
    const lessonSubject = Array.isArray(profile.subjects) && typeof profile.subjects[0] === "string" ? profile.subjects[0] : profile.subject;
    const events = bookings.flatMap(booking => { const slot = slotMap.get(booking.slot_id); return slot ? ["BEGIN:VEVENT", `UID:${booking.id}@lessonharbour`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(slot.starts_at)}`, `DTEND:${icsDate(slot.ends_at)}`, `SUMMARY:${icsEscape(`${lessonSubject} lesson`)}`, "DESCRIPTION:Confirmed LessonHarbour booking", "STATUS:CONFIRMED", "END:VEVENT"] : []; });
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LessonHarbour//Lessons//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:LessonHarbour lessons", ...events, "END:VCALENDAR", ""].join("\r\n");
    return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300", "Content-Disposition": "inline; filename=lessonharbour.ics", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); const { account } = await requireAccount("tutor"); await enforceRateLimit(account.id, "calendar-feed", 5, 300); const profile = (await selectRows<{ calendar_feed_token: string | null }>("tutor_profiles", { select: "calendar_feed_token", user_id: `eq.${account.id}`, limit: 1 }))[0]; if (!profile) throw new ApiError(409, "Save your tutor profile before enabling calendar sync"); const token = profile.calendar_feed_token ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join(""); if (!profile.calendar_feed_token) await updateRows("tutor_profiles", { calendar_feed_token: token }, { user_id: `eq.${account.id}` }); return json({ feedUrl: `/api/calendar-feed?token=${token}` }); } catch (error) { return handleApiError(error); }
}
export async function DELETE(request: Request) { try { assertSameOrigin(request); const { account } = await requireAccount("tutor"); await updateRows("tutor_profiles", { calendar_feed_token: null }, { user_id: `eq.${account.id}` }); return json({ disabled: true }); } catch (error) { return handleApiError(error); } }
