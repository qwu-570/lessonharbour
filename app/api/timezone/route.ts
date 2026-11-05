import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cf = (request as Request & { cf?: { timezone?: string } }).cf;
  return json({ timeZone: cf?.timezone ?? null });
}
