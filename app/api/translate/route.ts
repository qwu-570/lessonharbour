import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, readJson, requireAccount, textValue } from "@/lib/api";
import { translateText } from "@/lib/translation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "profile-translation", 10, 3600);
    const body = await readJson<{ text?: unknown; target?: unknown }>(request);
    const source = textValue(body.text, "Biography", 30, 2000);
    const target = body.target === "EN" || body.target === "ZH" ? body.target : null;
    if (!target) throw new ApiError(400, "Translation target must be EN or ZH");
    return json(await translateText(source, target));
  } catch (error) { return handleApiError(error); }
}
