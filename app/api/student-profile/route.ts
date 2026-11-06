import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { studentProfiles } from "@/db/schema";
import { ApiError, assertSameOrigin, handleApiError, json, parseStringList, readJson, requireAccount, stringList, textValue } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("student");
    const body = await readJson<{ studentName?: unknown; postcode?: unknown; subjects?: unknown }>(request);
    const postcode = textValue(body.postcode, "Postcode", 5, 10).toUpperCase().replace(/\s+/g, " ");
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(postcode)) throw new ApiError(400, "Enter a valid UK postcode");
    const values = {
      userId: account.id,
      studentName: textValue(body.studentName, "Student name", 2, 80),
      postcode,
      subjects: JSON.stringify(stringList(body.subjects, "Subjects", 12, 60)),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    if (JSON.parse(values.subjects).length === 0) throw new ApiError(400, "Choose at least one tutoring subject");
    await getDb().insert(studentProfiles).values(values).onConflictDoUpdate({ target: studentProfiles.userId, set: values });
    const profile = (await getDb().select().from(studentProfiles).where(eq(studentProfiles.userId, account.id)).limit(1))[0];
    return json({ profile: { ...profile, subjects: parseStringList(profile.subjects) } });
  } catch (error) { return handleApiError(error); }
}
