import "server-only";

import type { MailMessage } from "@/server/email";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES } from "@/server/otp/logic";

/**
 * E-mail du second facteur (C1) — sobre (B4), aucune donnée personnelle
 * au-delà de l'adresse de destination, aucune identité superflue.
 */
export function buildOtpEmail(to: string, code: string): MailMessage {
  const subject = "Votre code de connexion";
  const text = [
    `Votre code de connexion App Natation : ${code}`,
    "",
    `Ce code est valable ${OTP_TTL_MINUTES} minutes, pour une seule connexion,`,
    `et devient inutilisable après ${OTP_MAX_ATTEMPTS} tentatives erronées.`,
    "",
    "Si vous n'êtes pas à l'origine de cette connexion, modifiez votre mot de passe sans attendre.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="fr">
  <body style="margin: 0; padding: 24px; background-color: #f7f9fb; font-family: Arial, Helvetica, sans-serif; color: #0f172a">
    <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px">
      <h1 style="margin: 0 0 16px; font-size: 20px">Votre code de connexion</h1>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5">
        Saisissez ce code pour terminer votre connexion à App Natation&nbsp;:
      </p>
      <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace">${code}</p>
      <p style="margin: 0 0 16px; font-size: 13px; color: #64748b">
        Ce code est valable ${OTP_TTL_MINUTES}&nbsp;minutes, pour une seule connexion, et devient
        inutilisable après ${OTP_MAX_ATTEMPTS}&nbsp;tentatives erronées.
      </p>
      <p style="margin: 0; font-size: 13px; color: #64748b">
        Si vous n'êtes pas à l'origine de cette connexion, modifiez votre mot de passe sans attendre.
      </p>
    </div>
  </body>
</html>
`;
  return { to, subject, text, html };
}
