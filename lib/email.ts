import { env } from "cloudflare:workers";

type EmailConfig = { CLOUDFLARE_EMAIL_API_TOKEN?: string; CLOUDFLARE_ACCOUNT_ID?: string; EMAIL_FROM?: string; SITE_URL?: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function sendBookingEmail(to: string, subject: string, message: string) {
  const config = env as unknown as EmailConfig;
  if (!config.CLOUDFLARE_EMAIL_API_TOKEN || !config.CLOUDFLARE_ACCOUNT_ID || !config.EMAIL_FROM) {
    console.info(JSON.stringify({ message: "booking email skipped: email service is not configured", subject }));
    return { sent: false as const };
  }
  const siteUrl = config.SITE_URL ?? "https://lessonharbour-live-mvp.qling-wu.chatgpt.site";
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.CLOUDFLARE_EMAIL_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: { address: config.EMAIL_FROM, name: "LessonHarbour" },
        subject,
        text: `${message}\n\nOpen LessonHarbour: ${siteUrl}`,
        html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(siteUrl)}">Open LessonHarbour</a></p>`,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error(JSON.stringify({ message: "booking email failed", status: response.status, detail: detail.slice(0, 200) }));
      return { sent: false as const };
    }
    return { sent: true as const };
  } catch (error) {
    console.error(JSON.stringify({ message: "booking email failed", error: error instanceof Error ? error.message : "unknown" }));
    return { sent: false as const };
  }
}
