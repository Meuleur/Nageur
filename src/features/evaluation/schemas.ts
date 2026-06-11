import { z } from "zod";

/**
 * Schéma Zod de l'auto-évaluation (E-15, RG-34, A4) — source unique,
 * appliquée côté client (UX) ET côté serveur (sécurité, D2). Ressenti
 * global 1–5 obligatoire ; difficulté perçue 1–10 et commentaire
 * facultatifs (B2). Une auto-évaluation par séance, modifiable (ADR-018).
 */

export const RESSENTI_VALEURS = ["1", "2", "3", "4", "5"] as const;
export const DIFFICULTE_VALEURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;

export const COMMENTAIRE_MAX = 500;

export const autoEvaluationSchema = z.object({
  seanceId: z.uuid("Séance invalide."),
  ressenti: z
    .enum(RESSENTI_VALEURS, "Indiquez votre ressenti global (1 à 5).")
    .transform(Number),
  difficulte: z
    .enum(DIFFICULTE_VALEURS, "Difficulté invalide.")
    .transform(Number)
    .nullable(),
  commentaire: z
    .string("Commentaire invalide.")
    .trim()
    .max(COMMENTAIRE_MAX, `${COMMENTAIRE_MAX} caractères maximum.`)
    .transform((texte) => (texte === "" ? null : texte)),
});

export type AutoEvaluation = z.output<typeof autoEvaluationSchema>;

/**
 * Extraction des champs E-15 depuis le FormData — même mapping côté client
 * (validation avant envoi) et côté serveur (action). Difficulté absente ou
 * « non précisée » (valeur vide) → null.
 */
export function parseAutoEvaluationFormData(formData: FormData) {
  const difficulte = formData.get("difficulte");
  return {
    seanceId: formData.get("seance_id"),
    ressenti: formData.get("ressenti"),
    difficulte: difficulte === null || difficulte === "" ? null : difficulte,
    commentaire: formData.get("commentaire") ?? "",
  };
}
