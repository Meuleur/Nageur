/**
 * Lecture de la boîte Mailpit locale (`supabase start`) : les e-mails de
 * Supabase Auth (vérification, réinitialisation) ET les e-mails applicatifs
 * (code OTP, EMAIL_DRIVER=mailpit) y aboutissent — les parcours E2E les
 * consomment comme un utilisateur réel.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export type ReceivedEmail = {
  id: string;
  subject: string;
  text: string;
  html: string;
};

/** Identifiant du dernier e-mail reçu pour une adresse (null si aucun). */
export async function latestEmailId(to: string): Promise<string | null> {
  const search = new URLSearchParams({ query: `to:"${to}"`, limit: "1" });
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?${search}`);
  if (!response.ok) {
    throw new Error(`Mailpit injoignable (HTTP ${response.status}) — \`pnpm supabase:start\` ?`);
  }
  const body = (await response.json()) as { messages?: Array<{ ID: string }> };
  return body.messages?.[0]?.ID ?? null;
}

/**
 * Attend un e-mail PLUS RÉCENT que `afterId` (capturer latestEmailId avant
 * l'action qui déclenche l'envoi), puis renvoie son contenu.
 */
export async function waitForEmail(
  to: string,
  options: { afterId: string | null; timeoutMs?: number },
): Promise<ReceivedEmail> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const id = await latestEmailId(to);
    if (id && id !== options.afterId) {
      const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
      const message = (await response.json()) as { Subject: string; Text: string; HTML: string };
      return { id, subject: message.Subject, text: message.Text, html: message.HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Aucun nouvel e-mail pour ${to} en ${timeoutMs} ms. ` +
      "(Rappel : Supabase Auth espace certains envois de 60 s — relancer la suite après une minute.)",
  );
}

/** Code OTP à 6 chiffres de l'e-mail applicatif (C1). */
export function extractOtpCode(email: ReceivedEmail): string {
  const match = email.text.match(/\b(\d{6})\b/);
  if (!match) {
    throw new Error(`Pas de code à 6 chiffres dans l'e-mail « ${email.subject} ».`);
  }
  return match[1];
}

/** Lien /auth/confirm d'un e-mail GoTrue (entités HTML décodées). */
export function extractConfirmLink(email: ReceivedEmail): string {
  const match = email.html.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
  if (!match) {
    throw new Error(`Pas de lien /auth/confirm dans l'e-mail « ${email.subject} ».`);
  }
  return match[1].replace(/&amp;/g, "&");
}
