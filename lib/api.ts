import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits, users } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";

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
  const rows = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function requireAccount(role?: "student" | "tutor") {
  const identity = await requireIdentity();
  const account = await getAccount(identity.userId);
  if (!account) throw new ApiError(403, "Complete account setup first");
  if (role && account.role !== role) throw new ApiError(403, `${role === "student" ? "Student" : "Tutor"} access required`);
  return { identity, account };
}

export async function enforceRateLimit(userId: string, action: string, limit = 30, windowSeconds = 60) {
  const db = getDb();
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const key = `${userId}:${action}`;
  await db.insert(rateLimits).values({ key, windowStart, count: 1 }).onConflictDoUpdate({
    target: [rateLimits.key, rateLimits.windowStart],
    set: { count: sql`${rateLimits.count} + 1` },
  });
  const rows = await db.select({ count: rateLimits.count }).from(rateLimits)
    .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart))).limit(1);
  if ((rows[0]?.count ?? 0) > limit) throw new ApiError(429, "Too many requests. Please try again shortly.");
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
