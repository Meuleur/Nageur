import "server-only";

import { Resend } from "resend";

import { getEmailDriver, getEmailFrom, getMailpitUrl, getResendApiKey } from "@/server/env";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Décompose `Nom <adresse>` (EMAIL_FROM) pour l'API Mailpit. */
function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.*)<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  }
  return { name: "", email: from.trim() };
}

async function sendWithResend(message: MailMessage): Promise<void> {
  const resend = new Resend(getResendApiKey());
  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (error) {
    throw new Error(`Resend: échec d'envoi (${error.name})`);
  }
}

async function sendWithMailpit(message: MailMessage): Promise<void> {
  const from = parseFrom(getEmailFrom());
  const response = await fetch(`${getMailpitUrl()}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Name: from.name, Email: from.email },
      To: [{ Email: message.to }],
      Subject: message.subject,
      Text: message.text,
      HTML: message.html,
    }),
  });
  if (!response.ok) {
    throw new Error(`Mailpit: HTTP ${response.status}`);
  }
}

/**
 * Envoi d'un e-mail applicatif (code OTP 2FA — C1). Les e-mails propres à
 * Supabase Auth (vérification d'inscription, réinitialisation) partent par
 * son SMTP (Resend en production, Mailpit en local — supabase/config.toml).
 * Ne jamais journaliser le contenu : il transporte des codes de sécurité.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (getEmailDriver() === "mailpit") {
    return sendWithMailpit(message);
  }
  return sendWithResend(message);
}
