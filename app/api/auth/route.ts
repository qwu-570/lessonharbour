import { ApiError, assertSameOrigin, handleApiError, json, readJson, textValue } from "@/lib/api";
import { getSupabaseAuthConfig } from "@/lib/identity";

export const dynamic = "force-dynamic";

type AuthSession = { access_token: string; refresh_token: string; expires_in: number; user?: { id: string; email?: string } };

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function sessionResponse(data: AuthSession, status = 200) {
  const response = json({ authenticated: true, email: data.user?.email ?? null }, { status });
  response.headers.append("Set-Cookie", cookie("lh_access_token", data.access_token, Math.max(60, data.expires_in - 30)));
  response.headers.append("Set-Cookie", cookie("lh_refresh_token", data.refresh_token, 60 * 60 * 24 * 30));
  return response;
}

async function authRequest(path: string, body: unknown) {
  const { url, key } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json<Record<string, unknown> & Partial<AuthSession>>();
  if (!response.ok) throw new ApiError(response.status === 400 ? 401 : response.status, String(data.msg ?? data.error_description ?? data.message ?? "Authentication failed"));
  return data;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson<{ action?: string; email?: string; password?: string; displayName?: string }>(request);
    const action = body.action;
    if (action === "refresh") {
      const refreshToken = request.headers.get("Cookie")?.match(/(?:^|; )lh_refresh_token=([^;]+)/)?.[1];
      if (!refreshToken) throw new ApiError(401, "Session expired");
      const data = await authRequest("token?grant_type=refresh_token", { refresh_token: decodeURIComponent(refreshToken) });
      return sessionResponse(data as unknown as AuthSession);
    }
    const email = textValue(body.email, "Email", 5, 254).toLowerCase();
    const password = textValue(body.password, "Password", 8, 128);
    if (action === "signup") {
      const displayName = textValue(body.displayName, "Display name", 2, 60);
      const data = await authRequest(`signup?redirect_to=${encodeURIComponent(new URL(request.url).origin)}`, { email, password, data: { display_name: displayName } });
      if (!data.access_token) return json({ authenticated: false, verificationRequired: true, message: "Check your email to verify your account, then sign in." }, { status: 201 });
      return sessionResponse(data as unknown as AuthSession, 201);
    }
    if (action !== "login") throw new ApiError(400, "Invalid authentication action");
    return sessionResponse(await authRequest("token?grant_type=password", { email, password }) as unknown as AuthSession);
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const response = json({ authenticated: false });
    response.headers.append("Set-Cookie", cookie("lh_access_token", "", 0));
    response.headers.append("Set-Cookie", cookie("lh_refresh_token", "", 0));
    return response;
  } catch (error) { return handleApiError(error); }
}
