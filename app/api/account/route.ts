import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertSameOrigin, enforceRateLimit, enumValue, getAccount, handleApiError, json, readJson, requireIdentity, textValue } from "@/lib/api";
import { accountRoles } from "@/lib/rules";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireIdentity();
    await enforceRateLimit(identity.userId, "account", 5, 300);
    if (await getAccount(identity.userId)) return json({ error: "Account already exists" }, { status: 409 });
    const body = await readJson<{ role?: unknown; displayName?: unknown }>(request);
    const role = enumValue(body.role, "role", accountRoles);
    const displayName = textValue(body.displayName ?? identity.displayName, "Display name", 2, 60);
    await getDb().insert(users).values({ id: identity.userId, email: identity.email, displayName, role });
    return json({ account: { id: identity.userId, email: identity.email, displayName, role } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
