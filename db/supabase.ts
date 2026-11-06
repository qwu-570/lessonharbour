import { env } from "cloudflare:workers";

type QueryValue = string | number | boolean;

function config() {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is unavailable");
  return { url, key };
}

async function request<T>(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) {
    const details = await response.text();
    console.error(JSON.stringify({ message: "Supabase request failed", status: response.status, details }));
    const error = new Error(`Database request failed (${response.status})`);
    Object.assign(error, { status: response.status, details });
    throw error;
  }
  if (response.status === 204) return null as T;
  return await response.json<T>();
}

function queryString(query: Record<string, QueryValue | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  return params.toString();
}

export function selectRows<T>(table: string, query: Record<string, QueryValue | undefined> = {}) {
  const suffix = queryString(query);
  return request<T[]>(`${table}${suffix ? `?${suffix}` : ""}`);
}

export function insertRows<T>(table: string, values: unknown, options: { upsert?: boolean; onConflict?: string } = {}) {
  const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
  const prefer = ["return=representation", options.upsert ? "resolution=merge-duplicates" : ""].filter(Boolean).join(",");
  return request<T[]>(`${table}${query}`, { method: "POST", headers: { Prefer: prefer }, body: JSON.stringify(values) });
}

export function updateRows<T>(table: string, values: unknown, query: Record<string, QueryValue | undefined>) {
  return request<T[]>(`${table}?${queryString(query)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(values) });
}

export function deleteRows<T>(table: string, query: Record<string, QueryValue | undefined>) {
  return request<T[]>(`${table}?${queryString(query)}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
}

export function rpc<T>(name: string, values: unknown) {
  return request<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(values) });
}

export function isConflict(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 409;
}
