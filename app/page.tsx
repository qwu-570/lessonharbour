import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import LessonHarbourApp from "./lessonharbour-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getChatGPTUser();
  return (
    <LessonHarbourApp
      initialIdentity={identity ? { displayName: identity.displayName, email: identity.email } : null}
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
