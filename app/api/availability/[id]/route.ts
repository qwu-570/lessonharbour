import { deleteRows, selectRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, requireAccount } from "@/lib/api";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "availability-delete", 20, 300);
    const { id } = await context.params;
    const slot = (await selectRows<{ id: string }>("availability_slots", { select: "id", id: `eq.${id}`, tutor_id: `eq.${account.id}`, limit: 1 }))[0];
    const booking = (await selectRows<{ id: string }>("bookings", { select: "id", slot_id: `eq.${id}`, limit: 1 }))[0];
    if (!slot || booking) throw new ApiError(404, "Unbooked slot not found");
    await deleteRows("availability_slots", { id: `eq.${id}`, tutor_id: `eq.${account.id}` });
    return json({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
