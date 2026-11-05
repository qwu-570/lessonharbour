import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { availabilitySlots, bookings } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, requireAccount } from "@/lib/api";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "availability-delete", 20, 300);
    const { id } = await context.params;
    const deletable = await getDb().select({ id: availabilitySlots.id }).from(availabilitySlots)
      .leftJoin(bookings, eq(bookings.slotId, availabilitySlots.id))
      .where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.tutorId, account.id), isNull(bookings.id))).limit(1);
    if (!deletable[0]) throw new ApiError(404, "Unbooked slot not found");
    await getDb().delete(availabilitySlots).where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.tutorId, account.id)));
    return json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
