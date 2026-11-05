import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { availabilitySlots, bookings, tutorProfiles, users } from "@/db/schema";
import { ApiError, handleApiError, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const profileRows = await getDb().select({
      id: users.id, displayName: users.displayName, subject: tutorProfiles.subject, bio: tutorProfiles.bio,
      hourlyPrice: tutorProfiles.hourlyPrice, lessonFormat: tutorProfiles.lessonFormat,
      generalLocation: tutorProfiles.generalLocation,
    }).from(tutorProfiles).innerJoin(users, eq(users.id, tutorProfiles.userId))
      .where(and(eq(tutorProfiles.userId, id), eq(tutorProfiles.isPublished, true))).limit(1);
    if (!profileRows[0]) throw new ApiError(404, "Tutor not found");
    const slots = await getDb().select({ id: availabilitySlots.id, startsAt: availabilitySlots.startsAt, endsAt: availabilitySlots.endsAt })
      .from(availabilitySlots).leftJoin(bookings, eq(bookings.slotId, availabilitySlots.id))
      .where(and(eq(availabilitySlots.tutorId, id), gt(availabilitySlots.startsAt, new Date().toISOString()), isNull(bookings.id)))
      .orderBy(availabilitySlots.startsAt).limit(50);
    return json({ tutor: profileRows[0], slots });
  } catch (error) {
    return handleApiError(error);
  }
}
