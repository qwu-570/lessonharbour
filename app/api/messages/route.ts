import { and, asc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, studentProfiles, users } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, readJson, requireAccount, textValue } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { account } = await requireAccount();
    const rows = await getDb().select().from(messages).where(or(eq(messages.studentId, account.id), eq(messages.tutorId, account.id))).orderBy(asc(messages.createdAt)).limit(500);
    const otherIds = [...new Set(rows.map(row => row.studentId === account.id ? row.tutorId : row.studentId))];
    const people = otherIds.length ? await getDb().select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, otherIds)) : [];
    const names = new Map(people.map(person => [person.id, person.displayName]));
    return json({ messages: rows.map(row => ({ ...row, otherId: row.studentId === account.id ? row.tutorId : row.studentId, otherName: names.get(row.studentId === account.id ? row.tutorId : row.studentId) ?? "LessonHarbour user" })) });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount();
    await enforceRateLimit(account.id, "message-send", 30, 60);
    const body = await readJson<{ recipientId?: unknown; body?: unknown }>(request);
    const recipientId = textValue(body.recipientId, "Recipient", 10, 100);
    const messageBody = textValue(body.body, "Message", 1, 1000);
    const recipient = (await getDb().select({ id: users.id, role: users.role }).from(users).where(eq(users.id, recipientId)).limit(1))[0];
    if (!recipient || recipient.id === account.id) throw new ApiError(404, "Recipient not found");

    let studentId: string;
    let tutorId: string;
    if (account.role === "student") {
      if (recipient.role !== "tutor") throw new ApiError(400, "Students can message tutors only");
      const profile = (await getDb().select({ id: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.userId, account.id)).limit(1))[0];
      if (!profile) throw new ApiError(409, "Complete the required student profile before messaging a tutor");
      studentId = account.id; tutorId = recipientId;
    } else {
      if (recipient.role !== "student") throw new ApiError(400, "Tutors can reply to students only");
      const existing = (await getDb().select({ id: messages.id }).from(messages).where(and(eq(messages.studentId, recipientId), eq(messages.tutorId, account.id))).limit(1))[0];
      if (!existing) throw new ApiError(403, "You can reply after the student sends the first message");
      studentId = recipientId; tutorId = account.id;
    }
    const message = { id: crypto.randomUUID(), studentId, tutorId, senderId: account.id, body: messageBody };
    await getDb().insert(messages).values(message);
    return json({ message }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
