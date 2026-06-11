import type { StatutSeance } from "@/features/seances/statuts";

/**
 * Transitions de traitement côté coach (A3, RG-26) — module pur partagé par
 * les écrans E-21/E-22, l'action serveur et les tests. La garde définitive
 * vit côté base (fonction traiter_seance + trigger seances_statut_terminal).
 */

/** Décisions portées par le formulaire E-22 — « modifier » passe par E-23 (T3). */
export const DECISIONS_TRAITEMENT = ["valider", "refuser"] as const;
export type DecisionTraitement = (typeof DECISIONS_TRAITEMENT)[number];

/** A3 : T2 valider → validee ; T4 refuser → refusee. */
export const STATUT_CIBLE_PAR_DECISION: Record<
  DecisionTraitement,
  Exclude<StatutSeance, "en_attente">
> = {
  valider: "validee",
  refuser: "refusee",
};

/**
 * RG-26/RG-30 : seules les séances en attente se traitent — les statuts
 * validee/modifiee/refusee sont terminaux (aucune action proposée, A3).
 */
export function peutEtreTraitee(statut: StatutSeance): boolean {
  return statut === "en_attente";
}
