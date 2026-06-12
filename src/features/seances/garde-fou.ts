/**
 * Garde-fou anti-abus de la génération (ADR-027) — module pur, testable.
 * C'est une protection de sécurité (coût tokens / emballement), distincte
 * d'un quota produit : RG-24 (aucun quota ni délai en usage normal) reste
 * respecté, le seuil (RATE_LIMITS.generationByUser) n'étant atteignable
 * qu'en automatisant les requêtes.
 */
export function messageGenerationLimitee(retryAfterSeconds?: number): string {
  const reprise =
    retryAfterSeconds === undefined
      ? "quelques instants"
      : retryAfterSeconds > 1
        ? `environ ${retryAfterSeconds} secondes`
        : "une seconde";
  return (
    "Vous avez lancé beaucoup de générations en très peu de temps. " +
    `Par mesure de sécurité, patientez ${reprise} avant de réessayer.`
  );
}
