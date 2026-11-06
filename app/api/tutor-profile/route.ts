import { insertRows } from "@/db/supabase";
import { assertSameOrigin, enforceRateLimit, enumValue, handleApiError, integerValue, json, optionalHttpsUrl, parseStringList, readJson, requireAccount, stringList, textValue } from "@/lib/api";
import { lessonFormats } from "@/lib/rules";

type ProfileBody = { subject?: unknown; bio?: unknown; bioEn?: unknown; bioZh?: unknown; hourlyPrice?: unknown; lessonFormat?: unknown; generalLocation?: unknown; profilePhotoUrl?: unknown; languages?: unknown; isPublished?: unknown };

async function save(request: Request) {
  assertSameOrigin(request);
  const { account } = await requireAccount("tutor");
  await enforceRateLimit(account.id, "profile", 10, 300);
  const body = await readJson<ProfileBody>(request);
  const values = {
    user_id: account.id,
    subject: textValue(body.subject, "Subject", 2, 60),
    bio: textValue(body.bio, "Biography", 30, 800),
    bio_en: body.bioEn ? textValue(body.bioEn, "English biography", 30, 800) : null,
    bio_zh: body.bioZh ? textValue(body.bioZh, "Chinese biography", 15, 800) : null,
    hourly_price: integerValue(body.hourlyPrice, "Hourly price", 5, 200),
    lesson_format: enumValue(body.lessonFormat, "lesson format", lessonFormats),
    general_location: body.generalLocation ? textValue(body.generalLocation, "Location", 2, 100) : null,
    profile_photo_url: optionalHttpsUrl(body.profilePhotoUrl, "Profile photo"),
    languages: stringList(body.languages, "Languages"),
    is_published: body.isPublished === true,
    updated_at: new Date().toISOString(),
  };
  const profile = (await insertRows<Record<string, unknown>>("tutor_profiles", values, { upsert: true, onConflict: "user_id" }))[0];
  return json({ profile: { userId: profile.user_id, subject: profile.subject, bio: profile.bio, bioEn: profile.bio_en, bioZh: profile.bio_zh, hourlyPrice: profile.hourly_price, lessonFormat: profile.lesson_format, generalLocation: profile.general_location, profilePhotoUrl: profile.profile_photo_url, languages: parseStringList(profile.languages as unknown[]), calendarFeedToken: profile.calendar_feed_token, isPublished: profile.is_published, updatedAt: profile.updated_at } });
}

export async function POST(request: Request) { try { return await save(request); } catch (error) { return handleApiError(error); } }
export async function PATCH(request: Request) { try { return await save(request); } catch (error) { return handleApiError(error); } }
