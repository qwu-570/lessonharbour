import { and, asc, eq, gt, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { availabilitySlots, bookings } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, isoDateValue, json, readJson, requireAccount } from "@/lib/api";
import { validateLessonWindow } from "@/lib/rules";

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
    const body = await readJson<{ startsAt?: unknown; endsAt?: unknown }>(request);
    const startsAt = isoDateValue(body.startsAt, "Start time");
    const endsAt = isoDateValue(body.endsAt, "End time");
    const timeError = validateLessonWindow(startsAt, endsAt);
    if (timeError) throw new ApiError(400, timeError);
    const startIso = startsAt.toISOString();
    const endIso = endsAt.toISOString();
    const overlap = await getDb().select({ id: availabilitySlots.id }).from(availabilitySlots).where(and(
      eq(availabilitySlots.tutorId, account.id),
      or(
        and(lt(availabilitySlots.startsAt, endIso), gt(availabilitySlots.endsAt, startIso)),
        and(eq(availabilitySlots.startsAt, startIso), eq(availabilitySlots.endsAt, endIso)),
      ),
    )).limit(1);
    if (overlap[0]) throw new ApiError(409, "This time overlaps an existing slot");
    const slot = { id: crypto.randomUUID(), tutorId: account.id, startsAt: startIso, endsAt: endIso };
    await getDb().insert(availabilitySlots).values(slot);
    return json({ slot }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
