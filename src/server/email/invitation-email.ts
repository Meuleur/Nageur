import "server-only";

import type { MailMessage } from "@/server/email";
import { buildEmailMetier } from "@/server/notifications/emails";

/**
 * E-mail d'invitation d'un coach (E-33, C4/RG-02) — même enveloppe B4 que
 * les e-mails métier CH7. Le lien transporte le jeton GoTrue d'invitation
 * (validité 24 h, otp_expiry — config.toml) vers /auth/confirm?type=invite :
 * consommer le lien n'authentifie pas (gating C1), il ouvre uniquement la
 * définition du mot de passe. Aucun mot de passe ne transite jamais.
 */
export function buildInvitationCoachEmail(params: {
  to: string;
  prenom: string;
  appUrl: string;
  tokenHash: string;
}): MailMessage {
  const url = `${params.appUrl}/auth/confirm?token_hash=${encodeURIComponent(params.tokenHash)}&type=invite`;
  return buildEmailMetier({
    to: params.to,
    sujet: "Activez votre compte coach",
    titre: "Bienvenue sur App Natation",
    paragraphes: [
      `Bonjour ${params.prenom}, un compte coach vient d'être créé pour vous sur App Natation.`,
      "Définissez votre mot de passe pour activer votre compte — vous pourrez ensuite vous connecter et relire les séances de vos nageurs.",
      "Ce lien est valable 24 heures et ne sert qu'une fois. Passé ce délai, demandez une nouvelle invitation.",
    ],
    action: { libelle: "Définir mon mot de passe", url },
  });
}
