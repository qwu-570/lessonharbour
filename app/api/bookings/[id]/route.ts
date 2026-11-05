import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, enumValue, handleApiError, json, readJson, requireAccount } from "@/lib/api";
import { bookingResponses, canRespondToBooking } from "@/lib/rules";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "booking-response", 20, 300);
    const { id } = await context.params;
    const body = await readJson<{ status?: unknown }>(request);
    const status = enumValue(body.status, "booking status", bookingResponses);
    const existing = (await getDb().select().from(bookings).where(and(
      eq(bookings.id, id), eq(bookings.tutorId, account.id), eq(bookings.status, "pending"),
    )).limit(1))[0];
    if (!existing) throw new ApiError(404, "Pending booking not found");
    if (!canRespondToBooking(existing.status, status)) throw new ApiError(409, "Booking cannot be updated from its current status");
    await getDb().update(bookings).set({ status, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(bookings.id, id), eq(bookings.tutorId, account.id), eq(bookings.status, "pending")));
    return json({ booking: { ...existing, status } });
  } catch (error) {
    return handleApiError(error);
  }
}
