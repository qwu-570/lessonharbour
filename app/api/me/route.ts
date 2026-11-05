import { getDb } from "@/db";
import { tutorProfiles } from "@/db/schema";
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
    return json({ authenticated: true, identity, account, profile });
  } catch (error) {
    return handleApiError(error);
  }
}
