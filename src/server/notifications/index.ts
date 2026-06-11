import "server-only";

import { sendMail } from "@/server/email";
import { getAppUrl } from "@/server/env";

import { journaliserEvenementNotification } from "./audit";
import { chargerEmailProfil, chargerSeancePourNotification } from "./destinataires";
import {
  notifierCoachSeanceEnAttenteAvecDeps,
  notifierNageurCoachAffecteAvecDeps,
  notifierNageurSeanceTraiteeAvecDeps,
  type DepsNotification,
  type StatutTraite,
} from "./notification";

export type { StatutTraite } from "./notification";

/**
 * Interface serveur des notifications métier N4–N8 (C3, RG-36/RG-37) —
 * câblage réel de l'orchestrateur pur (./notification). À appeler hors du
 * chemin critique de l'action métier, via `after()` de next/server
 * (ADR-020) : aucune de ces fonctions ne rejette jamais.
 */
function depsReelles(): DepsNotification {
  return {
    chargerSeance: chargerSeancePourNotification,
    chargerEmail: chargerEmailProfil,
    envoyer: sendMail,
    journaliser: journaliserEvenementNotification,
    attendre: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    appUrl: getAppUrl(),
  };
}

/** N4 (RG-36) — après création d'une séance en_attente (T1, action CH5). */
export async function notifierCoachSeanceEnAttente(seanceId: string): Promise<void> {
  return notifierCoachSeanceEnAttenteAvecDeps(depsReelles(), seanceId);
}

/** N5/N6/N7 (RG-37) — après traiter_seance réussie (T2/T3/T4, actions CH6). */
export async function notifierNageurSeanceTraitee(traitement: {
  seanceId: string;
  statut: StatutTraite;
}): Promise<void> {
  return notifierNageurSeanceTraiteeAvecDeps(depsReelles(), traitement);
}

/**
 * N8 (PA-4) — nageur notifié à l'affectation d'un coach. PRÊT MAIS NON
 * BRANCHÉ : l'affectation coach↔nageur n'existe pas encore. Point d'appel
 * prévu (CH8) : l'action serveur d'affectation de l'admin, après l'écriture
 * de profiles.coach_id réussie — `after(() => notifierNageurCoachAffecte(nageurId))`.
 */
export async function notifierNageurCoachAffecte(nageurId: string): Promise<void> {
  return notifierNageurCoachAffecteAvecDeps(depsReelles(), nageurId);
}
