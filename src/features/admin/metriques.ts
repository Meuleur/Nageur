import { z } from "zod";

/**
 * Métriques agrégées du tableau de bord (E-30, RG-39) — validation Zod du
 * jsonb renvoyé par admin_metrics (D2 : on ne fait pas confiance à une
 * forme implicite). ADR-020 : uniquement des comptages et des sommes,
 * jamais de contenu de séance ni d'auto-évaluation.
 */

const compteur = z.number().int().nonnegative();

export const metriquesAdminSchema = z.object({
  comptes: z.object({
    coachs: compteur,
    nageurs: compteur,
    nageurs_sans_coach: compteur,
  }),
  seances: z.object({
    generees: compteur,
    validees: compteur,
    modifiees: compteur,
    refusees: compteur,
    en_attente: compteur,
  }),
  tokens: z.object({
    total: compteur,
    anthropic: compteur,
    openai: compteur,
  }),
  par_fournisseur: z.object({
    anthropic: compteur,
    openai: compteur,
  }),
  serie_generees_30j: z.array(
    z.object({
      jour: z.string(),
      generees: compteur,
    }),
  ),
});

export type MetriquesAdmin = z.infer<typeof metriquesAdminSchema>;

/** Taux de validation (C4) : (validées + modifiées) / générées sur la période. */
export function tauxValidation(seances: MetriquesAdmin["seances"]): number | null {
  if (seances.generees === 0) {
    return null;
  }
  return (seances.validees + seances.modifiees) / seances.generees;
}

/** Affichage du taux : pourcentage arrondi, ou tiret sans génération. */
export function formatTauxValidation(taux: number | null): string {
  if (taux === null) {
    return "—";
  }
  return `${Math.round(taux * 100)} %`;
}
