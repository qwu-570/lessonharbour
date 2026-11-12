import { selectRows, updateRows } from "@/db/supabase";
import { ApiError, assertSameOrigin, enforceRateLimit, handleApiError, json } from "@/lib/api";
import { translateText } from "@/lib/translation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    await enforceRateLimit(id, "public-biography-translation", 3, 3600);
    const profile = (await selectRows<{ bio: string; bio_zh: string | null }>("tutor_profiles", { select: "bio,bio_zh", user_id: `eq.${id}`, is_published: "eq.true", limit: 1 }))[0];
    if (!profile) throw new ApiError(404, "Tutor not found");
    if (profile.bio_zh) return json({ translation: profile.bio_zh, provider: "cache", cached: true });
    const result = await translateText(profile.bio, "ZH");
    await updateRows("tutor_profiles", { bio_zh: result.translation }, { user_id: `eq.${id}` });
    return json({ ...result, cached: false });
  } catch (error) {
    return handleApiError(error);
  }
}
