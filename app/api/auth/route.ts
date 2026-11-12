import { ApiError, assertSameOrigin, handleApiError, json, readJson, textValue } from "@/lib/api";
import { getSupabaseAuthConfig } from "@/lib/identity";

export const dynamic = "force-dynamic";

type AuthSession = { access_token: string; refresh_token: string; expires_in: number; user?: { id: string; email?: string } };

function requestCookie(request: Request, name: string) {
  const value = request.headers.get("Cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1];
  return value ? decodeURIComponent(value) : null;
}

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
    const body = await readJson<{ action?: string; email?: string; password?: string; displayName?: string; accessToken?: string; refreshToken?: string }>(request);
    const action = body.action;
    if (action === "refresh") {
      const refreshToken = requestCookie(request, "lh_refresh_token");
      if (!refreshToken) throw new ApiError(401, "Session expired");
      const data = await authRequest("token?grant_type=refresh_token", { refresh_token: refreshToken });
      return sessionResponse(data as unknown as AuthSession);
    }
    if (action === "recovery-session") {
      const accessToken = textValue(body.accessToken, "Recovery token", 20, 5000);
      const refreshToken = textValue(body.refreshToken, "Refresh token", 20, 5000);
      const { url, key } = getSupabaseAuthConfig();
      const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${accessToken}` } });
      if (!userResponse.ok) throw new ApiError(401, "This password reset link is invalid or has expired");
      const user = await userResponse.json<{ id: string; email?: string }>();
      return sessionResponse({ access_token: accessToken, refresh_token: refreshToken, expires_in: 3600, user });
    }
    if (action === "reset-password") {
      const password = textValue(body.password, "Password", 8, 128);
      const accessToken = requestCookie(request, "lh_access_token");
      if (!accessToken) throw new ApiError(401, "This password reset session has expired");
      const { url, key } = getSupabaseAuthConfig();
      const updateResponse = await fetch(`${url}/auth/v1/user`, { method: "PUT", headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await updateResponse.json<{ message?: string; msg?: string }>();
      if (!updateResponse.ok) throw new ApiError(updateResponse.status, result.msg ?? result.message ?? "Unable to update password");
      return json({ updated: true });
    }
    const email = textValue(body.email, "Email", 5, 254).toLowerCase();
    if (action === "request-reset") {
      await authRequest(`recover?redirect_to=${encodeURIComponent(new URL(request.url).origin)}`, { email });
      return json({ requested: true, message: "If an account exists for this email, a password reset link has been sent." });
    }
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
