import { getChatGPTUser } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export type Identity = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: "chatgpt" | "email";
};

type SupabaseUser = { id: string; email?: string; user_metadata?: { display_name?: string; full_name?: string } };

function authConfig() {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export async function getIdentity(): Promise<Identity | null> {
  const chatgpt = await getChatGPTUser();
  if (chatgpt) return { ...chatgpt, provider: "chatgpt" };

  const config = authConfig();
  if (!config) return null;
  const accessToken = (await cookies()).get("lh_access_token")?.value;
  if (!accessToken) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const user = await response.json<SupabaseUser>();
  if (!user.id || !user.email) return null;
  const displayName = user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email;
  return { userId: `supabase:${user.id}`, displayName, email: user.email, fullName: user.user_metadata?.full_name ?? null, provider: "email" };
}

export function getSupabaseAuthConfig() {
  const config = authConfig();
  if (!config) throw new Error("Email authentication is unavailable");
  return config;
}
