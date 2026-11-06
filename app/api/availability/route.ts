import { insertRows, selectRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, integerValue, isoDateValue, json, readJson, requireAccount } from "@/lib/api";
import { buildAvailabilityWindows, recurrencePatterns, validateLessonWindow } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { account } = await requireAccount("tutor");
    const rows = await selectRows<{ id: string; starts_at: string; ends_at: string }>("availability_slots", { select: "id,starts_at,ends_at", tutor_id: `eq.${account.id}`, order: "starts_at.asc" });
    const ids = rows.map(row => row.id);
    const bookingRows = ids.length ? await selectRows<{ id: string; slot_id: string; status: string }>("bookings", { select: "id,slot_id,status", slot_id: `in.(${ids.join(",")})` }) : [];
    const bookingBySlot = new Map(bookingRows.map(row => [row.slot_id, row]));
    return json({ slots: rows.map(row => ({ id: row.id, startsAt: row.starts_at, endsAt: row.ends_at, bookingId: bookingBySlot.get(row.id)?.id ?? null, bookingStatus: bookingBySlot.get(row.id)?.status ?? null })) });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "availability", 20, 300);
    const body = await readJson<{ startsAt?: unknown; durationMinutes?: unknown; recurrence?: unknown; timeZone?: unknown }>(request);
    const startsAt = isoDateValue(body.startsAt, "Start time");
    const durationMinutes = integerValue(body.durationMinutes, "Lesson duration", 30, 180);
    if (durationMinutes % 15 !== 0) throw new ApiError(400, "Lesson duration must use 15-minute intervals");
    const recurrence = typeof body.recurrence === "string" && recurrencePatterns.includes(body.recurrence as (typeof recurrencePatterns)[number]) ? body.recurrence as (typeof recurrencePatterns)[number] : null;
    if (!recurrence) throw new ApiError(400, "Invalid repeat pattern");
    const timeZone = typeof body.timeZone === "string" ? body.timeZone.slice(0, 100) : "UTC";
    try { new Intl.DateTimeFormat("en-GB", { timeZone }); } catch { throw new ApiError(400, "Invalid time zone"); }
    const windows = buildAvailabilityWindows(startsAt, durationMinutes, recurrence, timeZone);
    for (const window of windows) { const error = validateLessonWindow(window.startsAt, window.endsAt); if (error) throw new ApiError(400, error); }
    const existing = await selectRows<{ starts_at: string; ends_at: string }>("availability_slots", { select: "starts_at,ends_at", tutor_id: `eq.${account.id}`, starts_at: `lt.${windows.at(-1)!.endsAt.toISOString()}`, ends_at: `gt.${windows[0].startsAt.toISOString()}` });
    if (windows.some(window => existing.some(slot => slot.starts_at < window.endsAt.toISOString() && slot.ends_at > window.startsAt.toISOString()))) throw new ApiError(409, "One or more repeated times overlap an existing slot");
    const values = windows.map(window => ({ id: crypto.randomUUID(), tutor_id: account.id, starts_at: window.startsAt.toISOString(), ends_at: window.endsAt.toISOString() }));
    const rows = await insertRows<{ id: string; starts_at: string; ends_at: string }>("availability_slots", values);
    return json({ slots: rows.map(row => ({ id: row.id, startsAt: row.starts_at, endsAt: row.ends_at })) }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
