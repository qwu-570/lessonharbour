import { env } from "cloudflare:workers";
import { ApiError } from "@/lib/api";

function translationChunks(value: string, maxBytes = 450) {
  const chunks: string[] = [];
  let rest = value.trim();
  const encoder = new TextEncoder();
  while (encoder.encode(rest).length > maxBytes) {
    let end = 1;
    while (end < rest.length && encoder.encode(rest.slice(0, end + 1)).length <= maxBytes) end += 1;
    const boundary = Math.max(rest.lastIndexOf("\n", end), rest.lastIndexOf(" ", end));
    const cut = boundary > end / 2 ? boundary : end;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function translateWithMyMemory(source: string, target: "EN" | "ZH") {
  const sourceLanguage = /[\u3400-\u9fff]/.test(source) ? "zh-CN" : "en";
  const targetLanguage = target === "ZH" ? "zh-CN" : "en";
  if (sourceLanguage === targetLanguage) return source;
  const translated: string[] = [];
  for (const chunk of translationChunks(source)) {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", chunk);
    url.searchParams.set("langpair", `${sourceLanguage}|${targetLanguage}`);
    url.searchParams.set("mt", "1");
    const response = await fetch(url);
    const result = await response.json<{ responseData?: { translatedText?: string }; responseStatus?: number; responseDetails?: string }>();
    const text = result.responseData?.translatedText?.trim();
    if (!response.ok || !text || (result.responseStatus && result.responseStatus >= 400)) throw new ApiError(502, result.responseDetails?.slice(0, 160) || "Backup translation service failed");
    translated.push(text);
  }
  return translated.join("\n\n");
}

export async function translateText(source: string, target: "EN" | "ZH") {
  const key = (env as unknown as { DEEPL_API_KEY?: string }).DEEPL_API_KEY;
  if (!key) return { translation: await translateWithMyMemory(source, target), provider: "MyMemory" };
  const endpoint = key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: [source], target_lang: target }) });
  const result = await response.json<{ translations?: Array<{ text?: string }>; message?: string }>();
  if (!response.ok || !result.translations?.[0]?.text) throw new ApiError(502, result.message?.slice(0, 160) || "Translation service failed");
  return { translation: result.translations[0].text, provider: "DeepL" };
}
