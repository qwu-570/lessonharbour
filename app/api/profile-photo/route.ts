import { env } from "cloudflare:workers";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { tutorProfiles } from "@/db/schema";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json, requireAccount } from "@/lib/api";

export const dynamic = "force-dynamic";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function GET(request: Request) {
  try {
    if (!env.BUCKET) throw new Error("R2 binding is unavailable");
    const key = new URL(request.url).searchParams.get("key") ?? "";
    if (!key.startsWith("avatars/") || key.includes("..")) throw new ApiError(400, "Invalid image key");
    const object = await env.BUCKET.get(key);
    if (!object) throw new ApiError(404, "Profile photo not found");
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=86400, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account } = await requireAccount("tutor");
    await enforceRateLimit(account.id, "profile-photo", 5, 600);
    if (!env.BUCKET) throw new Error("R2 binding is unavailable");
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) throw new ApiError(400, "Choose an image to upload");
    const extension = allowedTypes.get(file.type);
    if (!extension) throw new ApiError(400, "Profile photo must be JPEG, PNG or WebP");
    if (file.size < 1 || file.size > 3 * 1024 * 1024) throw new ApiError(400, "Profile photo must be smaller than 3 MB");
    const key = `avatars/${account.id}/${crypto.randomUUID()}.${extension}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    const profilePhotoUrl = `/api/profile-photo?key=${encodeURIComponent(key)}`;
    await getDb().update(tutorProfiles).set({ profilePhotoUrl, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(tutorProfiles.userId, account.id));
    return json({ profilePhotoUrl }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
