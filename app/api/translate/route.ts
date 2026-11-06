import { env } from "cloudflare:workers";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, readJson, requireAccount, textValue } from "@/lib/api";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "profile-translation", 10, 3600);
    const body = await readJson<{ text?: unknown; target?: unknown }>(request);
    const source = textValue(body.text, "Biography", 30, 2000);
    const target = body.target === "EN" || body.target === "ZH" ? body.target : null;
    if (!target) throw new ApiError(400, "Translation target must be EN or ZH");
    const key = (env as unknown as { DEEPL_API_KEY?: string }).DEEPL_API_KEY;
    if (!key) throw new ApiError(503, "Automatic translation is awaiting API configuration");
    const endpoint = key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: [source], target_lang: target }) });
    const result = await response.json<{ translations?: Array<{ text?: string }>; message?: string }>();
    if (!response.ok || !result.translations?.[0]?.text) throw new ApiError(502, result.message?.slice(0, 160) || "Translation service failed");
    return json({ translation: result.translations[0].text });
  } catch (error) { return handleApiError(error); }
}
