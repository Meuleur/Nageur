import "server-only";

/**
 * Accès aux variables d'environnement serveur (D3) : chaque secret vit en
 * variable d'environnement, est lu paresseusement (le build doit réussir
 * sans valeurs) et ne peut pas atteindre le bundle client ("server-only").
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable (see .env.example).`);
  }
  return value;
}

/**
 * Secret HMAC serveur (C1) : hachage des codes OTP, signature des jetons de
 * transition (2FA en attente, réinitialisation), clés de rate limiting.
 */
export function getAuthSecret(): string {
  const secret = required("AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters long (see .env.example).");
  }
  return secret;
}

export type EmailDriver = "resend" | "mailpit";

/**
 * "resend" en production (ADR-013) ; "mailpit" route les e-mails applicatifs
 * vers la boîte locale de `supabase start` (dev / E2E), aucun envoi réel.
 */
export function getEmailDriver(): EmailDriver {
  const driver = process.env.EMAIL_DRIVER ?? "resend";
  if (driver !== "resend" && driver !== "mailpit") {
    throw new Error(`Unsupported EMAIL_DRIVER "${driver}" (expected "resend" or "mailpit").`);
  }
  return driver;
}

export function getEmailFrom(): string {
  return required("EMAIL_FROM");
}

export function getResendApiKey(): string {
  return required("RESEND_API_KEY");
}

export function getMailpitUrl(): string {
  return process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
}

export type LlmDriver = "fournisseur" | "simule";

/**
 * "fournisseur" (défaut) appelle le fournisseur LLM actif (RG-38) ;
 * "simule" produit une séance déterministe sans réseau — dev local sans clé
 * réelle et tests E2E (D2). Jamais "simule" en production.
 */
export function getLlmDriver(): LlmDriver {
  const driver = process.env.LLM_DRIVER ?? "fournisseur";
  if (driver !== "fournisseur" && driver !== "simule") {
    throw new Error(`Unsupported LLM_DRIVER "${driver}" (expected "fournisseur" or "simule").`);
  }
  return driver;
}
