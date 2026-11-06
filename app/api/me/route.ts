import { getDb } from "@/db";
import { studentProfiles, tutorProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccount, handleApiError, json, parseStringList } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getChatGPTUser();
    if (!identity) return json({ authenticated: false, account: null });
    const account = await getAccount(identity.userId);
    const rawProfile = account?.role === "tutor"
      ? (await getDb().select().from(tutorProfiles).where(eq(tutorProfiles.userId, identity.userId)).limit(1))[0] ?? null
      : null;
    const profile = rawProfile ? { ...rawProfile, languages: parseStringList(rawProfile.languages) } : null;
    const rawStudentProfile = account?.role === "student"
      ? (await getDb().select().from(studentProfiles).where(eq(studentProfiles.userId, identity.userId)).limit(1))[0] ?? null
      : null;
    const studentProfile = rawStudentProfile ? { ...rawStudentProfile, subjects: parseStringList(rawStudentProfile.subjects) } : null;
    return json({ authenticated: true, identity, account, profile, studentProfile });
  } catch (error) {
    return handleApiError(error);
  }
}
