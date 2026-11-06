import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, users } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, enumValue, handleApiError, json, readJson, requireAccount, textValue } from "@/lib/api";
import { sendBookingEmail } from "@/lib/email";
import { bookingResponses, canRespondToBooking } from "@/lib/rules";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount();
    await enforceRateLimit(account.id, "booking-response", 20, 300);
    const { id } = await context.params;
    const body = await readJson<{ status?: unknown; reason?: unknown }>(request);
    const existing = (await getDb().select().from(bookings).where(and(eq(bookings.id, id), or(eq(bookings.tutorId, account.id), eq(bookings.studentId, account.id)))).limit(1))[0];
    if (!existing) throw new ApiError(404, "Booking not found");

    if (body.status === "cancelled") {
      if (existing.status !== "accepted") throw new ApiError(409, "Only accepted bookings can be cancelled");
      const reason = textValue(body.reason, "Cancellation reason", 5, 500);
      await getDb().update(bookings).set({ status: "cancelled", cancelledBy: account.id, cancellationReason: reason, cancelledAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(bookings.id, id), eq(bookings.status, "accepted")));
      const otherId = account.id === existing.tutorId ? existing.studentId : existing.tutorId;
      const other = (await getDb().select({ email: users.email, displayName: users.displayName }).from(users).where(eq(users.id, otherId)).limit(1))[0];
      if (other) await sendBookingEmail(other.email, "LessonHarbour lesson cancelled", `Hello ${other.displayName}, an accepted lesson has been cancelled. Reason: ${reason}`);
      return json({ booking: { ...existing, status: "cancelled", cancelledBy: account.id, cancellationReason: reason } });
    }

    if (account.role !== "tutor" || existing.tutorId !== account.id || existing.status !== "pending") throw new ApiError(403, "Only the tutor can respond to a pending booking");
    const status = enumValue(body.status, "booking status", bookingResponses);
    if (!canRespondToBooking(existing.status, status)) throw new ApiError(409, "Booking cannot be updated from its current status");
    await getDb().update(bookings).set({ status, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(bookings.id, id), eq(bookings.tutorId, account.id), eq(bookings.status, "pending")));
    const student = (await getDb().select({ email: users.email, displayName: users.displayName }).from(users).where(eq(users.id, existing.studentId)).limit(1))[0];
    if (student) await sendBookingEmail(student.email, `LessonHarbour booking ${status}`, `Hello ${student.displayName}, your lesson request has been ${status}.`);
    return json({ booking: { ...existing, status } });
  } catch (error) {
    return handleApiError(error);
  }
}
