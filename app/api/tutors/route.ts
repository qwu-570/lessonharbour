import { and, eq, like } from "drizzle-orm";
import { getDb } from "@/db";
import { tutorProfiles, users } from "@/db/schema";
import { handleApiError, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const subject = new URL(request.url).searchParams.get("subject")?.trim().slice(0, 60) ?? "";
    const condition = subject
      ? and(eq(tutorProfiles.isPublished, true), like(tutorProfiles.subject, `%${subject}%`))
      : eq(tutorProfiles.isPublished, true);
    const tutors = await getDb().select({
      id: users.id,
      displayName: users.displayName,
      subject: tutorProfiles.subject,
      bio: tutorProfiles.bio,
      hourlyPrice: tutorProfiles.hourlyPrice,
      lessonFormat: tutorProfiles.lessonFormat,
      generalLocation: tutorProfiles.generalLocation,
    }).from(tutorProfiles).innerJoin(users, eq(users.id, tutorProfiles.userId)).where(condition).limit(100);
    return json({ tutors });
  } catch (error) {
    return handleApiError(error);
  }
}
