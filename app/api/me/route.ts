import { selectRows } from "@/db/supabase";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccount, handleApiError, json, parseStringList } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getChatGPTUser();
    if (!identity) return json({ authenticated: false, account: null });
    const account = await getAccount(identity.userId);
    const rawProfile = account?.role === "tutor"
      ? (await selectRows<Record<string, unknown>>("tutor_profiles", { select: "*", user_id: `eq.${identity.userId}`, limit: 1 }))[0] ?? null
      : null;
    const profile = rawProfile ? { userId: rawProfile.user_id, subject: rawProfile.subject, subjects: parseStringList((rawProfile.subjects as unknown[]) ?? [rawProfile.subject]), bio: rawProfile.bio, bioEn: rawProfile.bio_en, bioZh: rawProfile.bio_zh, hourlyPrice: rawProfile.hourly_price, lessonFormat: rawProfile.lesson_format, generalLocation: rawProfile.general_location, postcode: rawProfile.postcode, profilePhotoUrl: rawProfile.profile_photo_url, languages: parseStringList(rawProfile.languages as unknown[]), calendarFeedToken: rawProfile.calendar_feed_token, isPublished: rawProfile.is_published, updatedAt: rawProfile.updated_at } : null;
    const rawStudentProfile = account?.role === "student"
      ? (await selectRows<Record<string, unknown>>("student_profiles", { select: "*", user_id: `eq.${identity.userId}`, limit: 1 }))[0] ?? null
      : null;
    const studentProfile = rawStudentProfile ? { userId: rawStudentProfile.user_id, studentName: rawStudentProfile.student_name, postcode: rawStudentProfile.postcode, subjects: parseStringList(rawStudentProfile.subjects as unknown[]), updatedAt: rawStudentProfile.updated_at } : null;
    return json({ authenticated: true, identity, account, profile, studentProfile });
  } catch (error) {
    return handleApiError(error);
  }
}
