/**
 * Statuts de séance côté nageur (A3, RG-32) — module pur partagé par la
 * liste (E-13), le détail (E-14) et les tests. Les codes sont ceux de
 * l'énum `statut_seance` (E1) ; les libellés suivent A3, les couleurs B4.
 */

export const STATUTS_SEANCE = ["en_attente", "validee", "modifiee", "refusee"] as const;
export type StatutSeance = (typeof STATUTS_SEANCE)[number];

export const STATUT_LABELS: Record<StatutSeance, string> = {
  en_attente: "En attente",
  validee: "Validée",
  modifiee: "Modifiée par le coach",
  refusee: "Refusée",
};

/** Variantes du badge de statut (components/ui/badge.tsx, tokens B4). */
export const STATUT_BADGE_VARIANTS: Record<
  StatutSeance,
  "pending" | "valid" | "modified" | "refused"
> = {
  en_attente: "pending",
  validee: "valid",
  modifiee: "modified",
  refusee: "refused",
};

/**
 * RG-32/A3 : seules « Validée » et « Modifiée par le coach » sont
 * consultables en détail et utilisables par le nageur.
 */
export function estUtilisable(statut: StatutSeance): boolean {
  return statut === "validee" || statut === "modifiee";
}

export function estStatutSeance(valeur: unknown): valeur is StatutSeance {
  return STATUTS_SEANCE.includes(valeur as StatutSeance);
}
