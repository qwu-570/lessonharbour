import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getIdentity } from "@/lib/identity";
import LessonHarbourApp from "./lessonharbour-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getIdentity();
  return (
    <LessonHarbourApp
      initialIdentity={identity ? { displayName: identity.displayName, email: identity.email, provider: identity.provider } : null}
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
