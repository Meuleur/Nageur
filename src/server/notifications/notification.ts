import type { StatutSeance } from "@/features/seances/statuts";
import type { MailMessage } from "@/server/email";

import {
  buildEmailCoachAffecte,
  buildEmailSeanceEnAttente,
  buildEmailSeanceModifiee,
  buildEmailSeanceRefusee,
  buildEmailSeanceValidee,
} from "./emails";

/**
 * Orchestration des notifications métier N4–N8 (C3, ADR-020) — module pur à
 * dépendances injectées, comme la génération CH4. Garanties :
 *   - jamais d'exception : un échec (destinataire, envoi, journal) est avalé
 *     après journalisation — l'action métier n'est jamais compromise ;
 *   - quelques tentatives d'envoi (DELAIS_RELANCE_MS) avant d'abandonner ;
 *   - journal sans donnée personnelle ni contenu : type d'événement et
 *     identifiants pseudonymes uniquement (E2).
 */

export type TypeNotification = "N4" | "N5" | "N6" | "N7" | "N8";

/** Statuts terminaux issus du traitement coach (A3 : T2/T3/T4). */
export type StatutTraite = Exclude<StatutSeance, "en_attente">;

export const NOTIFICATION_PAR_STATUT: Record<StatutTraite, TypeNotification> = {
  validee: "N5",
  modifiee: "N6",
  refusee: "N7",
};

export type SeancePourNotification = {
  nageurId: string;
  coachId: string | null;
  commentaireCoach: string | null;
};

export type EvenementNotification = {
  type: "notification.envoyee" | "notification.echec";
  /** Identifiants pseudonymes uniquement — jamais d'e-mail ni de contenu (E2). */
  metadata: {
    notification: TypeNotification;
    seance_id?: string;
    destinataire_id?: string;
    tentatives?: number;
    motif?: "envoi_echoue" | "seance_introuvable" | "destinataire_introuvable";
  };
};

export type DepsNotification = {
  chargerSeance(seanceId: string): Promise<SeancePourNotification | null>;
  chargerEmail(profilId: string): Promise<string | null>;
  envoyer(message: MailMessage): Promise<void>;
  /** Journal best effort : un échec d'audit ne casse jamais le parcours. */
  journaliser(evenement: EvenementNotification): Promise<void>;
  attendre(ms: number): Promise<void>;
  appUrl: string;
};

/** Relances après le premier échec (ADR-020 : « quelques tentatives »). */
export const DELAIS_RELANCE_MS = [1000, 3000];

/** Journalisation elle-même best effort — ne propage jamais. */
async function journaliser(
  deps: DepsNotification,
  evenement: EvenementNotification,
): Promise<void> {
  try {
    await deps.journaliser(evenement);
  } catch {
    console.error(`notifications: journalisation impossible (${evenement.metadata.notification})`);
  }
}

/** Envoi avec relances puis journal du résultat — résout toujours. */
async function envoyerAvecTentatives(
  deps: DepsNotification,
  notification: TypeNotification,
  message: MailMessage,
  journal: { seanceId?: string; destinataireId: string },
): Promise<void> {
  const tentativesMax = DELAIS_RELANCE_MS.length + 1;
  for (let tentative = 1; tentative <= tentativesMax; tentative++) {
    try {
      await deps.envoyer(message);
      await journaliser(deps, {
        type: "notification.envoyee",
        metadata: {
          notification,
          seance_id: journal.seanceId,
          destinataire_id: journal.destinataireId,
          tentatives: tentative,
        },
      });
      return;
    } catch {
      if (tentative < tentativesMax) {
        await deps.attendre(DELAIS_RELANCE_MS[tentative - 1]);
      }
    }
  }

  console.error(`notifications: échec d'envoi après ${tentativesMax} tentatives (${notification})`);
  await journaliser(deps, {
    type: "notification.echec",
    metadata: {
      notification,
      seance_id: journal.seanceId,
      destinataire_id: journal.destinataireId,
      tentatives: tentativesMax,
      motif: "envoi_echoue",
    },
  });
}

/** Préparation impossible (séance ou destinataire) : journal puis abandon. */
async function abandonner(
  deps: DepsNotification,
  notification: TypeNotification,
  metadata: Omit<EvenementNotification["metadata"], "notification">,
): Promise<void> {
  await journaliser(deps, {
    type: "notification.echec",
    metadata: { notification, ...metadata },
  });
}

/** N4 (RG-36, T1) : la séance vient d'être créée en_attente → coach affecté. */
export async function notifierCoachSeanceEnAttenteAvecDeps(
  deps: DepsNotification,
  seanceId: string,
): Promise<void> {
  try {
    const seance = await deps.chargerSeance(seanceId);
    if (!seance) {
      return abandonner(deps, "N4", { seance_id: seanceId, motif: "seance_introuvable" });
    }
    if (!seance.coachId) {
      return abandonner(deps, "N4", { seance_id: seanceId, motif: "destinataire_introuvable" });
    }
    const email = await deps.chargerEmail(seance.coachId);
    if (!email) {
      return abandonner(deps, "N4", {
        seance_id: seanceId,
        destinataire_id: seance.coachId,
        motif: "destinataire_introuvable",
      });
    }
    await envoyerAvecTentatives(
      deps,
      "N4",
      buildEmailSeanceEnAttente({ to: email, appUrl: deps.appUrl, seanceId }),
      { seanceId, destinataireId: seance.coachId },
    );
  } catch {
    // Dernier filet ADR-020 : une notification ne remonte jamais d'erreur.
    console.error("notifications: échec inattendu (N4)");
  }
}

/** N5/N6/N7 (RG-37, T2/T3/T4) : la transition vient d'aboutir → nageur. */
export async function notifierNageurSeanceTraiteeAvecDeps(
  deps: DepsNotification,
  traitement: { seanceId: string; statut: StatutTraite },
): Promise<void> {
  const notification = NOTIFICATION_PAR_STATUT[traitement.statut];
  try {
    const seance = await deps.chargerSeance(traitement.seanceId);
    if (!seance) {
      return abandonner(deps, notification, {
        seance_id: traitement.seanceId,
        motif: "seance_introuvable",
      });
    }
    const email = await deps.chargerEmail(seance.nageurId);
    if (!email) {
      return abandonner(deps, notification, {
        seance_id: traitement.seanceId,
        destinataire_id: seance.nageurId,
        motif: "destinataire_introuvable",
      });
    }

    const params = { to: email, appUrl: deps.appUrl, seanceId: traitement.seanceId };
    const message =
      notification === "N5"
        ? buildEmailSeanceValidee(params)
        : notification === "N6"
          ? buildEmailSeanceModifiee(params)
          : // Commentaire garanti non vide au refus (RG-29, contrainte E1).
            buildEmailSeanceRefusee({
              to: email,
              appUrl: deps.appUrl,
              commentaire: seance.commentaireCoach ?? "",
            });

    await envoyerAvecTentatives(deps, notification, message, {
      seanceId: traitement.seanceId,
      destinataireId: seance.nageurId,
    });
  } catch {
    console.error(`notifications: échec inattendu (${notification})`);
  }
}

/**
 * N8 (PA-4, ADR-020) : un coach vient d'être affecté au nageur. Prêt à
 * l'emploi — le point d'appel (action d'affectation, CH8) n'existe pas
 * encore ; voir README.
 */
export async function notifierNageurCoachAffecteAvecDeps(
  deps: DepsNotification,
  nageurId: string,
): Promise<void> {
  try {
    const email = await deps.chargerEmail(nageurId);
    if (!email) {
      return abandonner(deps, "N8", {
        destinataire_id: nageurId,
        motif: "destinataire_introuvable",
      });
    }
    await envoyerAvecTentatives(
      deps,
      "N8",
      buildEmailCoachAffecte({ to: email, appUrl: deps.appUrl }),
      { destinataireId: nageurId },
    );
  } catch {
    console.error("notifications: échec inattendu (N8)");
  }
}
