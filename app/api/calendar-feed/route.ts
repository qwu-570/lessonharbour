import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { availabilitySlots, bookings, tutorProfiles } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, requireAccount } from "@/lib/api";

export const dynamic = "force-dynamic";

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(404, "Calendar not found");
    const profile = (await getDb().select({ userId: tutorProfiles.userId, subject: tutorProfiles.subject })
      .from(tutorProfiles).where(eq(tutorProfiles.calendarFeedToken, token)).limit(1))[0];
    if (!profile) throw new ApiError(404, "Calendar not found");

    const lessons = await getDb().select({
      id: bookings.id,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
    }).from(bookings).innerJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
      .where(and(eq(bookings.tutorId, profile.userId), eq(bookings.status, "accepted")))
      .orderBy(asc(availabilitySlots.startsAt));

    const events = lessons.flatMap((lesson) => [
      "BEGIN:VEVENT",
      `UID:${lesson.id}@lessonharbour`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(lesson.startsAt)}`,
      `DTEND:${icsDate(lesson.endsAt)}`,
      `SUMMARY:${icsEscape(`${profile.subject} lesson`)}`,
      "DESCRIPTION:Confirmed LessonHarbour booking",
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ]);
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LessonHarbour//Lessons//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:LessonHarbour lessons", ...events, "END:VCALENDAR", ""].join("\r\n");
    return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300", "Content-Disposition": "inline; filename=lessonharbour.ics", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "calendar-feed", 5, 300);
    const profile = (await getDb().select({ token: tutorProfiles.calendarFeedToken }).from(tutorProfiles).where(eq(tutorProfiles.userId, account.id)).limit(1))[0];
    if (!profile) throw new ApiError(409, "Save your tutor profile before enabling calendar sync");
    const token = profile.token ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join("");
    if (!profile.token) await getDb().update(tutorProfiles).set({ calendarFeedToken: token }).where(eq(tutorProfiles.userId, account.id));
    return json({ feedUrl: `/api/calendar-feed?token=${token}` });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await getDb().update(tutorProfiles).set({ calendarFeedToken: null }).where(eq(tutorProfiles.userId, account.id));
    return json({ disabled: true });
  } catch (error) {
    return handleApiError(error);
  }
}
