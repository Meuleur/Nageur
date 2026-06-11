import type { MailMessage } from "@/server/email";

/**
 * Gabarits des e-mails métier N4–N8 (C3) — module pur, sans accès réseau ni
 * environnement : l'URL de l'application est injectée par l'appelant.
 * Charte B4 (sobre, FR) et données minimales (E2) : jamais de nom, d'adresse
 * tierce ni de contenu de séance — la seule exception est le commentaire de
 * refus du coach, partie intégrante de N7 (C3/RG-29). L'action principale
 * renvoie vers l'écran concerné ; l'authentification reste exigée à l'arrivée.
 */

export type ParametresGabarit = {
  to: string;
  sujet: string;
  titre: string;
  /** Paragraphes courts, sans donnée superflue (C3). */
  paragraphes: string[];
  /** Texte cité (commentaire de refus N7) — échappé dans la version HTML. */
  citation?: string;
  action?: { libelle: string; url: string };
};

/** Le commentaire du coach est du texte libre : jamais interprété en HTML. */
function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PIED_DE_PAGE =
  "App Natation — notification automatique liée à votre compte. " +
  "E-mail transactionnel : il ne comporte pas de lien de désinscription.";

/** Mise en forme commune (B4) — même enveloppe que l'e-mail OTP de CH2. */
export function buildEmailMetier(parametres: ParametresGabarit): MailMessage {
  const { to, sujet, titre, paragraphes, citation, action } = parametres;

  const text = [
    ...paragraphes,
    ...(citation ? ["", `« ${citation} »`] : []),
    ...(action ? ["", `${action.libelle} : ${action.url}`] : []),
    "",
    PIED_DE_PAGE,
  ].join("\n");

  const blocs: string[] = paragraphes.map(
    (paragraphe) =>
      `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5">${paragraphe}</p>`,
  );
  if (citation) {
    blocs.push(
      `<blockquote style="margin: 0 0 16px; padding: 12px 16px; background-color: #e0f2fe; border-radius: 8px; font-size: 15px; line-height: 1.5">${echapperHtml(citation)}</blockquote>`,
    );
  }
  if (action) {
    blocs.push(
      `<p style="margin: 0 0 16px"><a href="${action.url}" style="display: inline-block; background-color: #0ea5e9; color: #ffffff; font-size: 15px; font-weight: 600; padding: 10px 20px; border-radius: 8px; text-decoration: none">${action.libelle}</a></p>`,
    );
  }

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin: 0; padding: 24px; background-color: #f7f9fb; font-family: Arial, Helvetica, sans-serif; color: #0f172a">
    <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px">
      <h1 style="margin: 0 0 16px; font-size: 20px">${titre}</h1>
      ${blocs.join("\n      ")}
      <p style="margin: 0; font-size: 13px; color: #64748b">${PIED_DE_PAGE}</p>
    </div>
  </body>
</html>
`;

  return { to, subject: sujet, text, html };
}

/** N4 (RG-36, T1) — coach affecté : une séance attend sa validation. */
export function buildEmailSeanceEnAttente(params: {
  to: string;
  appUrl: string;
  seanceId: string;
}): MailMessage {
  return buildEmailMetier({
    to: params.to,
    sujet: "Une séance attend votre validation",
    titre: "Une séance attend votre validation",
    paragraphes: [
      "Un de vos nageurs vient de proposer une nouvelle séance d'entraînement sur App Natation.",
      "Elle reste invisible pour lui tant que vous ne l'avez pas relue.",
    ],
    action: {
      libelle: "Relire la séance",
      url: `${params.appUrl}/coach/seances/${params.seanceId}`,
    },
  });
}

/** N5 (RG-37, T2) — nageur : sa séance validée est disponible. */
export function buildEmailSeanceValidee(params: {
  to: string;
  appUrl: string;
  seanceId: string;
}): MailMessage {
  return buildEmailMetier({
    to: params.to,
    sujet: "Votre séance est disponible",
    titre: "Votre séance est disponible",
    paragraphes: [
      "Votre coach a validé votre séance d'entraînement : elle est maintenant disponible.",
    ],
    action: { libelle: "Voir ma séance", url: `${params.appUrl}/seances/${params.seanceId}` },
  });
}

/** N6 (RG-37, T3) — nageur : sa séance ajustée par le coach est disponible. */
export function buildEmailSeanceModifiee(params: {
  to: string;
  appUrl: string;
  seanceId: string;
}): MailMessage {
  return buildEmailMetier({
    to: params.to,
    sujet: "Votre séance ajustée est disponible",
    titre: "Votre séance ajustée est disponible",
    paragraphes: [
      "Votre coach a ajusté puis validé votre séance d'entraînement : elle est maintenant disponible dans sa version mise à jour.",
    ],
    action: { libelle: "Voir ma séance", url: `${params.appUrl}/seances/${params.seanceId}` },
  });
}

/** N7 (RG-37, T4) — nageur : séance refusée, commentaire + regénération (RG-33). */
export function buildEmailSeanceRefusee(params: {
  to: string;
  appUrl: string;
  commentaire: string;
}): MailMessage {
  return buildEmailMetier({
    to: params.to,
    sujet: "Votre séance a été refusée",
    titre: "Votre séance a été refusée",
    paragraphes: ["Votre coach a refusé votre proposition de séance, avec ce commentaire :"],
    citation: params.commentaire,
    action: {
      libelle: "Générer une nouvelle séance",
      url: `${params.appUrl}/seances/generer`,
    },
  });
}

/**
 * N8 (PA-4, ADR-020) — nageur : un coach lui a été affecté. Gabarit prêt ;
 * le déclenchement (affectation par l'admin) arrive en CH8.
 */
export function buildEmailCoachAffecte(params: { to: string; appUrl: string }): MailMessage {
  return buildEmailMetier({
    to: params.to,
    sujet: "Un coach vous a été affecté",
    titre: "Un coach vous a été affecté",
    paragraphes: [
      "Un coach vous a été affecté sur App Natation.",
      "Vous pouvez désormais générer vos séances d'entraînement : il les relira avant de les valider.",
    ],
    action: {
      libelle: "Générer ma première séance",
      url: `${params.appUrl}/seances/generer`,
    },
  });
}
