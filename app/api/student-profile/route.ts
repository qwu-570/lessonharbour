import { insertRows } from "@/db/supabase";
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
      user_id: account.id,
      student_name: textValue(body.studentName, "Student name", 2, 80),
      postcode,
      subjects: stringList(body.subjects, "Subjects", 12, 60),
      updated_at: new Date().toISOString(),
    };
    if (values.subjects.length === 0) throw new ApiError(400, "Choose at least one tutoring subject");
    const profile = (await insertRows<{ user_id: string; student_name: string; postcode: string; subjects: unknown[]; updated_at: string }>("student_profiles", values, { upsert: true, onConflict: "user_id" }))[0];
    return json({ profile: { userId: profile.user_id, studentName: profile.student_name, postcode: profile.postcode, subjects: parseStringList(profile.subjects), updatedAt: profile.updated_at } });
  } catch (error) { return handleApiError(error); }
}
