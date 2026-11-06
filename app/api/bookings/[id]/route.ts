import { selectRows, updateRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, enumValue, handleApiError, json, readJson, requireAccount, textValue } from "@/lib/api";
import { sendBookingEmail } from "@/lib/email";
import { bookingResponses, canRespondToBooking } from "@/lib/rules";

type BookingRow = { id: string; student_id: string; tutor_id: string; status: string };
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const { account } = await requireAccount(); await enforceRateLimit(account.id, "booking-response", 20, 300);
    const { id } = await context.params; const body = await readJson<{ status?: unknown; reason?: unknown }>(request);
    const existing = (await selectRows<BookingRow>("bookings", { select: "id,student_id,tutor_id,status", id: `eq.${id}`, or: `(student_id.eq.${account.id},tutor_id.eq.${account.id})`, limit: 1 }))[0];
    if (!existing) throw new ApiError(404, "Booking not found");
    if (body.status === "cancelled") {
      if (existing.status !== "accepted") throw new ApiError(409, "Only accepted bookings can be cancelled");
      const reason = textValue(body.reason, "Cancellation reason", 5, 500); const now = new Date().toISOString();
      await updateRows("bookings", { status: "cancelled", cancelled_by: account.id, cancellation_reason: reason, cancelled_at: now, updated_at: now }, { id: `eq.${id}`, status: "eq.accepted" });
      const otherId = account.id === existing.tutor_id ? existing.student_id : existing.tutor_id;
      const other = (await selectRows<{ email: string; display_name: string }>("users", { select: "email,display_name", id: `eq.${otherId}`, limit: 1 }))[0];
      if (other) await sendBookingEmail(other.email, "LessonHarbour lesson cancelled", `Hello ${other.display_name}, an accepted lesson has been cancelled. Reason: ${reason}`);
      return json({ booking: { id, status: "cancelled", cancelledBy: account.id, cancellationReason: reason } });
    }
    if (account.role !== "tutor" || existing.tutor_id !== account.id || existing.status !== "pending") throw new ApiError(403, "Only the tutor can respond to a pending booking");
    const status = enumValue(body.status, "booking status", bookingResponses);
    if (!canRespondToBooking(existing.status, status)) throw new ApiError(409, "Booking cannot be updated from its current status");
    await updateRows("bookings", { status, updated_at: new Date().toISOString() }, { id: `eq.${id}`, tutor_id: `eq.${account.id}`, status: "eq.pending" });
    const student = (await selectRows<{ email: string; display_name: string }>("users", { select: "email,display_name", id: `eq.${existing.student_id}`, limit: 1 }))[0];
    if (student) await sendBookingEmail(student.email, `LessonHarbour booking ${status}`, `Hello ${student.display_name}, your lesson request has been ${status}.`);
    return json({ booking: { id, status } });
  } catch (error) { return handleApiError(error); }
}
