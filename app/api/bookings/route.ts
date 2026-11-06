import { insertRows, isConflict, selectRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, parseStringList, readJson, requireAccount, textValue } from "@/lib/api";
import { sendBookingEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
type BookingRow = { id: string; slot_id: string; student_id: string; tutor_id: string; status: string; cancellation_reason: string | null; cancelled_by: string | null };

export async function GET() {
  try {
    const { account } = await requireAccount();
    const filter = account.role === "student" ? { student_id: `eq.${account.id}` } : { tutor_id: `eq.${account.id}` };
    const rows = await selectRows<BookingRow>("bookings", { select: "id,slot_id,student_id,tutor_id,status,cancellation_reason,cancelled_by", ...filter });
    const slotIds = rows.map(row => row.slot_id);
    const slots = slotIds.length ? await selectRows<{ id: string; starts_at: string; ends_at: string }>("availability_slots", { select: "id,starts_at,ends_at", id: `in.(${slotIds.join(",")})` }) : [];
    const otherIds = [...new Set(rows.map(row => account.role === "student" ? row.tutor_id : row.student_id))];
    const people = otherIds.length ? await selectRows<{ id: string; display_name: string }>("users", { select: "id,display_name", id: `in.(${otherIds.join(",")})` }) : [];
    const tutorIds = [...new Set(rows.map(row => row.tutor_id))];
    const profiles = tutorIds.length ? await selectRows<{ user_id: string; subject: string; subjects: unknown[] }>("tutor_profiles", { select: "user_id,subject,subjects", user_id: `in.(${tutorIds.join(",")})` }) : [];
    const slotMap = new Map(slots.map(row => [row.id, row])); const nameMap = new Map(people.map(row => [row.id, row.display_name])); const subjectMap = new Map(profiles.map(row => [row.user_id, parseStringList(row.subjects).slice(0, 2).join(" · ") || row.subject]));
    const result = rows.map(row => ({ id: row.id, status: row.status, subject: subjectMap.get(row.tutor_id), tutorName: account.role === "student" ? nameMap.get(row.tutor_id) : undefined, studentName: account.role === "tutor" ? nameMap.get(row.student_id) : undefined, startsAt: slotMap.get(row.slot_id)?.starts_at, endsAt: slotMap.get(row.slot_id)?.ends_at, cancellationReason: row.cancellation_reason, cancelledBy: row.cancelled_by })).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    return json({ bookings: result });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("student");
    if (!(await selectRows("student_profiles", { select: "user_id", user_id: `eq.${account.id}`, limit: 1 }))[0]) throw new ApiError(409, "Complete the required student profile before booking a lesson");
    await enforceRateLimit(account.id, "booking-create", 10, 300);
    const slotId = textValue((await readJson<{ slotId?: unknown }>(request)).slotId, "Slot ID", 10, 100);
    const slot = (await selectRows<{ id: string; tutor_id: string }>("availability_slots", { select: "id,tutor_id", id: `eq.${slotId}`, starts_at: `gt.${new Date().toISOString()}`, limit: 1 }))[0];
    if (!slot) throw new ApiError(404, "Available slot not found");
    if (slot.tutor_id === account.id) throw new ApiError(400, "You cannot book your own lesson");
    const value = { id: crypto.randomUUID(), slot_id: slotId, student_id: account.id, tutor_id: slot.tutor_id, status: "pending" };
    try { await insertRows("bookings", value); } catch (error) { if (isConflict(error)) throw new ApiError(409, "This slot has already been requested"); throw error; }
    const tutor = (await selectRows<{ email: string; display_name: string }>("users", { select: "email,display_name", id: `eq.${slot.tutor_id}`, limit: 1 }))[0];
    if (tutor) await sendBookingEmail(tutor.email, "New LessonHarbour booking request", `Hello ${tutor.display_name}, you have a new lesson request. Sign in to accept or reject it.`);
    return json({ booking: { id: value.id, slotId, studentId: account.id, tutorId: slot.tutor_id, status: "pending" } }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
