import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { tutorProfiles } from "@/db/schema";
import { assertSameOrigin, enforceRateLimit, enumValue, handleApiError, integerValue, json, optionalHttpsUrl, parseStringList, readJson, requireAccount, stringList, textValue } from "@/lib/api";
import { lessonFormats } from "@/lib/rules";

type ProfileBody = { subject?: unknown; bio?: unknown; hourlyPrice?: unknown; lessonFormat?: unknown; generalLocation?: unknown; profilePhotoUrl?: unknown; languages?: unknown; isPublished?: unknown };

async function save(request: Request) {
  assertSameOrigin(request);
  const { account } = await requireAccount("tutor");
  await enforceRateLimit(account.id, "profile", 10, 300);
  const body = await readJson<ProfileBody>(request);
  const values = {
    userId: account.id,
    subject: textValue(body.subject, "Subject", 2, 60),
    bio: textValue(body.bio, "Biography", 30, 800),
    hourlyPrice: integerValue(body.hourlyPrice, "Hourly price", 5, 200),
    lessonFormat: enumValue(body.lessonFormat, "lesson format", lessonFormats),
    generalLocation: body.generalLocation ? textValue(body.generalLocation, "Location", 2, 100) : null,
    profilePhotoUrl: optionalHttpsUrl(body.profilePhotoUrl, "Profile photo"),
    languages: JSON.stringify(stringList(body.languages, "Languages")),
    isPublished: body.isPublished === true,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  await getDb().insert(tutorProfiles).values(values).onConflictDoUpdate({ target: tutorProfiles.userId, set: values });
  const profile = (await getDb().select().from(tutorProfiles).where(eq(tutorProfiles.userId, account.id)).limit(1))[0];
  return json({ profile: { ...profile, languages: parseStringList(profile.languages) } });
}

export async function POST(request: Request) { try { return await save(request); } catch (error) { return handleApiError(error); } }
export async function PATCH(request: Request) { try { return await save(request); } catch (error) { return handleApiError(error); } }
