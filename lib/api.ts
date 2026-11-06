import { getChatGPTUser } from "@/app/chatgpt-auth";
import { rpc, selectRows } from "@/db/supabase";

export type Account = { id: string; email: string; displayName: string; role: "student" | "tutor"; createdAt?: string; updatedAt?: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(JSON.stringify({ message: "api request failed", error: message }));
  return json({ error: "Internal server error" }, { status: 500 });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Cross-origin write rejected");
}

export async function readJson<T>(request: Request): Promise<T> {
  const type = request.headers.get("Content-Type") ?? "";
  if (!type.toLowerCase().includes("application/json")) throw new ApiError(415, "Expected JSON request body");
  try {
    return await request.json<T>();
  } catch {
    throw new ApiError(400, "Invalid JSON request body");
  }
}

export async function requireIdentity() {
  const identity = await getChatGPTUser();
  if (!identity) throw new ApiError(401, "Sign in required");
  return identity;
}

export async function getAccount(userId: string) {
  const rows = await selectRows<{ id: string; email: string; display_name: string; role: "student" | "tutor"; created_at: string; updated_at: string }>("users", { select: "*", id: `eq.${userId}`, limit: 1 });
  const row = rows[0];
  return row ? { id: row.id, email: row.email, displayName: row.display_name, role: row.role, createdAt: row.created_at, updatedAt: row.updated_at } satisfies Account : null;
}

export async function requireAccount(role?: "student" | "tutor") {
  const identity = await requireIdentity();
  const account = await getAccount(identity.userId);
  if (!account) throw new ApiError(403, "Complete account setup first");
  if (role && account.role !== role) throw new ApiError(403, `${role === "student" ? "Student" : "Tutor"} access required`);
  return { identity, account };
}

export async function enforceRateLimit(userId: string, action: string, limit = 30, windowSeconds = 60) {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const key = `${userId}:${action}`;
  const count = await rpc<number>("increment_rate_limit", { p_key: key, p_window_start: windowStart });
  if (count > limit) throw new ApiError(429, "Too many requests. Please try again shortly.");
}

export function textValue(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "string") throw new ApiError(400, `${name} must be text`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new ApiError(400, `${name} must be ${min}-${max} characters`);
  return result;
}

export function integerValue(value: unknown, name: string, min: number, max: number) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new ApiError(400, `${name} must be between ${min} and ${max}`);
  return Number(value);
}

export function optionalHttpsUrl(value: unknown, name: string, max = 500) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > max) throw new ApiError(400, `${name} must be a valid HTTPS URL`);
  if (value.startsWith("/api/profile-photo?key=avatars%2F")) return value;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") throw new Error("HTTPS required");
    return url.toString();
  } catch {
    throw new ApiError(400, `${name} must be a valid HTTPS URL`);
  }
}

export function stringList(value: unknown, name: string, maxItems = 8, maxLength = 40) {
  if (!Array.isArray(value) || value.length > maxItems) throw new ApiError(400, `${name} must contain no more than ${maxItems} items`);
  const cleaned = value.map((item) => textValue(item, name, 2, maxLength));
  return [...new Set(cleaned)];
}

export function parseStringList(value: string | unknown[]) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function enumValue<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new ApiError(400, `Invalid ${name}`);
  return value as T;
}

export function isoDateValue(value: unknown, name: string) {
  if (typeof value !== "string") throw new ApiError(400, `${name} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${name} must be a valid date`);
  return date;
}
