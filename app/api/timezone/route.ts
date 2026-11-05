import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return json({ timeZone: request.headers.get("x-lessonharbour-visitor-timezone") });
}
