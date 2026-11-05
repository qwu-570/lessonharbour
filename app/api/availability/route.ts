import { and, asc, eq, gt, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { availabilitySlots, bookings } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, integerValue, isoDateValue, json, readJson, requireAccount } from "@/lib/api";
import { buildWeeklyWindows, validateLessonWindow } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { account } = await requireAccount("tutor");
    const slots = await getDb().select({
      id: availabilitySlots.id,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      bookingId: bookings.id,
      bookingStatus: bookings.status,
    }).from(availabilitySlots).leftJoin(bookings, eq(bookings.slotId, availabilitySlots.id))
      .where(eq(availabilitySlots.tutorId, account.id)).orderBy(asc(availabilitySlots.startsAt));
    return json({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "availability", 20, 300);
    const body = await readJson<{ startsAt?: unknown; durationMinutes?: unknown; repeatWeeks?: unknown }>(request);
    const startsAt = isoDateValue(body.startsAt, "Start time");
    const durationMinutes = integerValue(body.durationMinutes, "Lesson duration", 30, 180);
    if (durationMinutes % 15 !== 0) throw new ApiError(400, "Lesson duration must use 15-minute intervals");
    const repeatWeeks = integerValue(body.repeatWeeks, "Repeat weeks", 1, 12);
    const windows = buildWeeklyWindows(startsAt, durationMinutes, repeatWeeks);
    for (const window of windows) {
      const timeError = validateLessonWindow(window.startsAt, window.endsAt);
      if (timeError) throw new ApiError(400, timeError);
    }
    const firstStart = windows[0].startsAt.toISOString();
    const lastEnd = windows.at(-1)!.endsAt.toISOString();
    const existing = await getDb().select({ startsAt: availabilitySlots.startsAt, endsAt: availabilitySlots.endsAt }).from(availabilitySlots).where(and(
      eq(availabilitySlots.tutorId, account.id),
      or(and(lt(availabilitySlots.startsAt, lastEnd), gt(availabilitySlots.endsAt, firstStart))),
    ));
    const overlaps = windows.some((window) => existing.some((slot) => slot.startsAt < window.endsAt.toISOString() && slot.endsAt > window.startsAt.toISOString()));
    if (overlaps) throw new ApiError(409, "One or more repeated times overlap an existing slot");
    const slots = windows.map((window) => ({ id: crypto.randomUUID(), tutorId: account.id, startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString() }));
    await getDb().insert(availabilitySlots).values(slots);
    return json({ slots }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
