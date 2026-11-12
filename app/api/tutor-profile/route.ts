import { insertRows, selectRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, enumValue, handleApiError, integerValue, json, optionalHttpsUrl, parseStringList, readJson, requireAccount, stringList, textValue } from "@/lib/api";
import { lessonFormats } from "@/lib/rules";

type ProfileBody = { subject?: unknown; subjects?: unknown; bio?: unknown; bioEn?: unknown; bioZh?: unknown; hourlyPrice?: unknown; lessonFormat?: unknown; generalLocation?: unknown; postcode?: unknown; profilePhotoUrl?: unknown; languages?: unknown; isPublished?: unknown };

async function save(request: Request) {
  assertSameOrigin(request);
  const { account } = await requireAccount("tutor");
  await enforceRateLimit(account.id, "profile", 10, 300);
  const body = await readJson<ProfileBody>(request);
  const subjects = stringList(body.subjects ?? (body.subject ? [body.subject] : []), "Subjects", 20, 80);
  if (subjects.length === 0) throw new ApiError(400, "Choose at least one subject");
  const postcode = body.postcode ? textValue(body.postcode, "Postcode", 5, 10).toUpperCase().replace(/\s+/g, " ") : null;
  if (postcode && !/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(postcode)) throw new ApiError(400, "Enter a valid UK postcode");
  const biography = textValue(body.bio, "Biography", 30, 2000);
  const previous = (await selectRows<{ bio: string; bio_en: string | null; bio_zh: string | null }>("tutor_profiles", { select: "bio,bio_en,bio_zh", user_id: `eq.${account.id}`, limit: 1 }))[0];
  const values = {
    user_id: account.id,
    subject: subjects[0],
    subjects,
    bio: biography,
    bio_en: previous?.bio === biography ? previous.bio_en : null,
    bio_zh: previous?.bio === biography ? previous.bio_zh : null,
    hourly_price: integerValue(body.hourlyPrice, "Hourly price", 5, 200),
    lesson_format: enumValue(body.lessonFormat, "lesson format", lessonFormats),
    general_location: body.generalLocation ? textValue(body.generalLocation, "Location", 2, 100) : null,
    postcode,
    profile_photo_url: optionalHttpsUrl(body.profilePhotoUrl, "Profile photo"),
    languages: stringList(body.languages, "Languages"),
    is_published: body.isPublished === true,
    updated_at: new Date().toISOString(),
  };
  const profile = (await insertRows<Record<string, unknown>>("tutor_profiles", values, { upsert: true, onConflict: "user_id" }))[0];
  return json({ profile: { userId: profile.user_id, subject: profile.subject, subjects: parseStringList(profile.subjects as unknown[]), bio: profile.bio, bioEn: profile.bio_en, bioZh: profile.bio_zh, hourlyPrice: profile.hourly_price, lessonFormat: profile.lesson_format, generalLocation: profile.general_location, postcode: profile.postcode, profilePhotoUrl: profile.profile_photo_url, languages: parseStringList(profile.languages as unknown[]), calendarFeedToken: profile.calendar_feed_token, isPublished: profile.is_published, updatedAt: profile.updated_at } });
}

export async function POST(request: Request) { try { return await save(request); } catch (error) { return handleApiError(error); } }
export async function PATCH(request: Request) { try { return await save(request); } catch (error) { return handleApiError(error); } }
