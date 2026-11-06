import { insertRows, selectRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, readJson, requireAccount, textValue } from "@/lib/api";

export const dynamic = "force-dynamic";
type MessageRow = { id: string; student_id: string; tutor_id: string; sender_id: string; body: string; created_at: string };

export async function GET() {
  try {
    const { account } = await requireAccount();
    const rows = await selectRows<MessageRow>("messages", { select: "*", or: `(student_id.eq.${account.id},tutor_id.eq.${account.id})`, order: "created_at.asc", limit: 500 });
    const otherIds = [...new Set(rows.map(row => row.student_id === account.id ? row.tutor_id : row.student_id))];
    const people = otherIds.length ? await selectRows<{ id: string; display_name: string }>("users", { select: "id,display_name", id: `in.(${otherIds.join(",")})` }) : [];
    const names = new Map(people.map(person => [person.id, person.display_name]));
    return json({ messages: rows.map(row => { const otherId = row.student_id === account.id ? row.tutor_id : row.student_id; return { id: row.id, studentId: row.student_id, tutorId: row.tutor_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at, otherId, otherName: names.get(otherId) ?? "LessonHarbour user" }; }) });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const { account } = await requireAccount(); await enforceRateLimit(account.id, "message-send", 30, 60);
    const body = await readJson<{ recipientId?: unknown; body?: unknown }>(request); const recipientId = textValue(body.recipientId, "Recipient", 10, 100); const messageBody = textValue(body.body, "Message", 1, 1000);
    const recipient = (await selectRows<{ id: string; role: "student" | "tutor" }>("users", { select: "id,role", id: `eq.${recipientId}`, limit: 1 }))[0];
    if (!recipient || recipient.id === account.id) throw new ApiError(404, "Recipient not found");
    let studentId: string; let tutorId: string;
    if (account.role === "student") {
      if (recipient.role !== "tutor") throw new ApiError(400, "Students can message tutors only");
      if (!(await selectRows("student_profiles", { select: "user_id", user_id: `eq.${account.id}`, limit: 1 }))[0]) throw new ApiError(409, "Complete the required student profile before messaging a tutor");
      studentId = account.id; tutorId = recipientId;
    } else {
      if (recipient.role !== "student") throw new ApiError(400, "Tutors can reply to students only");
      if (!(await selectRows("messages", { select: "id", student_id: `eq.${recipientId}`, tutor_id: `eq.${account.id}`, limit: 1 }))[0]) throw new ApiError(403, "You can reply after the student sends the first message");
      studentId = recipientId; tutorId = account.id;
    }
    const value = { id: crypto.randomUUID(), student_id: studentId, tutor_id: tutorId, sender_id: account.id, body: messageBody };
    const row = (await insertRows<MessageRow>("messages", value))[0];
    return json({ message: { id: row.id, studentId: row.student_id, tutorId: row.tutor_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at } }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
