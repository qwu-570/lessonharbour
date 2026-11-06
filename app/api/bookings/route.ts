import { and, asc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { availabilitySlots, bookings, studentProfiles, tutorProfiles, users } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, readJson, requireAccount, textValue } from "@/lib/api";
import { sendBookingEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { account } = await requireAccount();
    if (account.role === "student") {
      const rows = await getDb().select({
        id: bookings.id, status: bookings.status, subject: tutorProfiles.subject,
        tutorName: users.displayName, startsAt: availabilitySlots.startsAt, endsAt: availabilitySlots.endsAt,
        cancellationReason: bookings.cancellationReason, cancelledBy: bookings.cancelledBy,
      }).from(bookings)
        .innerJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
        .innerJoin(users, eq(users.id, bookings.tutorId))
        .innerJoin(tutorProfiles, eq(tutorProfiles.userId, bookings.tutorId))
        .where(eq(bookings.studentId, account.id)).orderBy(asc(availabilitySlots.startsAt));
      return json({ bookings: rows });
    }
    const student = users;
    const rows = await getDb().select({
      id: bookings.id, status: bookings.status, studentName: student.displayName, subject: tutorProfiles.subject,
      startsAt: availabilitySlots.startsAt, endsAt: availabilitySlots.endsAt,
      cancellationReason: bookings.cancellationReason, cancelledBy: bookings.cancelledBy,
    }).from(bookings).innerJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
      .innerJoin(student, eq(student.id, bookings.studentId))
      .innerJoin(tutorProfiles, eq(tutorProfiles.userId, bookings.tutorId))
      .where(eq(bookings.tutorId, account.id)).orderBy(asc(availabilitySlots.startsAt));
    return json({ bookings: rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("student");
    const studentProfile = (await getDb().select({ id: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.userId, account.id)).limit(1))[0];
    if (!studentProfile) throw new ApiError(409, "Complete the required student profile before booking a lesson");
    await enforceRateLimit(account.id, "booking-create", 10, 300);
    const body = await readJson<{ slotId?: unknown }>(request);
    const slotId = textValue(body.slotId, "Slot ID", 10, 100);
    const slot = (await getDb().select().from(availabilitySlots).where(and(
      eq(availabilitySlots.id, slotId), gt(availabilitySlots.startsAt, new Date().toISOString()),
    )).limit(1))[0];
    if (!slot) throw new ApiError(404, "Available slot not found");
    if (slot.tutorId === account.id) throw new ApiError(400, "You cannot book your own lesson");
    const booking = { id: crypto.randomUUID(), slotId, studentId: account.id, tutorId: slot.tutorId, status: "pending" as const };
    try {
      await getDb().insert(bookings).values(booking);
    } catch {
      throw new ApiError(409, "This slot has already been requested");
    }
    const tutor = (await getDb().select({ email: users.email, displayName: users.displayName }).from(users).where(eq(users.id, slot.tutorId)).limit(1))[0];
    if (tutor) await sendBookingEmail(tutor.email, "New LessonHarbour booking request", `Hello ${tutor.displayName}, you have a new lesson request. Sign in to accept or reject it.`);
    return json({ booking }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
