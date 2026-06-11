import { z } from "zod";

import { blocSeanceSchema, serieGenereeSchema } from "@/features/seances/schemas";

/**
 * Schémas Zod du cycle de validation coach (E-22/E-23, RG-26 à RG-29) —
 * source unique, appliquée côté client (UX) ET côté serveur (sécurité, D2).
 * Les contraintes de contenu (distances multiples de 25 m, types de nage,
 * répétitions…) réutilisent les schémas de séance CH5 (A4/E1).
 */

export const COMMENTAIRE_COACH_MAX = 500;

export const COMMENTAIRE_REFUS_REQUIS =
  "Le commentaire est obligatoire pour refuser une séance : expliquez au nageur pourquoi.";

const seanceIdSchema = z.uuid("Séance invalide.");

/** Commentaire facultatif (validation T2, modification T3) — vide → null. */
const commentaireFacultatifSchema = z
  .string("Commentaire invalide.")
  .trim()
  .max(COMMENTAIRE_COACH_MAX, `${COMMENTAIRE_COACH_MAX} caractères maximum.`)
  .transform((texte) => (texte === "" ? null : texte));

/** RG-29 : commentaire obligatoire (et non vide) au refus (T4). */
const commentaireRefusSchema = z
  .string(COMMENTAIRE_REFUS_REQUIS)
  .trim()
  .min(1, COMMENTAIRE_REFUS_REQUIS)
  .max(COMMENTAIRE_COACH_MAX, `${COMMENTAIRE_COACH_MAX} caractères maximum.`);

/**
 * E-22 — décision portée par le bouton soumis (valider/refuser, RG-26) ;
 * « Modifier puis valider » navigue vers E-23 et passe par le schéma de
 * modification ci-dessous.
 */
export const traitementSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("valider"),
    seanceId: seanceIdSchema,
    commentaire: commentaireFacultatifSchema,
  }),
  z.object({
    decision: z.literal("refuser"),
    seanceId: seanceIdSchema,
    commentaire: commentaireRefusSchema,
  }),
]);

export type Traitement = z.output<typeof traitementSchema>;

/** Extraction des champs E-22 — même mapping côté client et côté serveur. */
export function parseTraitementFormData(formData: FormData) {
  return {
    decision: formData.get("decision"),
    seanceId: formData.get("seance_id"),
    commentaire: formData.get("commentaire") ?? "",
  };
}

/**
 * E-23 — contenu complet d'une séance modifiée par le coach (T3, RG-28) :
 * échauffement, séries (≥ 1, distances multiples de 25 m, types E1),
 * retour au calme, commentaire facultatif. La distance totale n'est pas
 * saisie : elle est recalculée du contenu par le serveur (E1).
 */
export const modificationSeanceSchema = z.object({
  seanceId: seanceIdSchema,
  echauffement: blocSeanceSchema,
  series: z
    .array(serieGenereeSchema, "Corps de séance invalide.")
    .min(1, "Le corps de séance doit contenir au moins une série."),
  retour_au_calme: blocSeanceSchema,
  commentaire: commentaireFacultatifSchema,
});

export type ModificationSeance = z.output<typeof modificationSeanceSchema>;

/** Champ numérique de formulaire : vide → undefined, non numérique → tel quel
 *  (Zod produit alors le message du champ). */
function nombre(valeur: FormDataEntryValue | null): unknown {
  const texte = String(valeur ?? "").trim();
  if (texte === "") {
    return undefined;
  }
  const n = Number(texte);
  return Number.isNaN(n) ? texte : n;
}

/**
 * Extraction des champs E-23 depuis le FormData. Les séries sont indexées
 * `series.{i}.…` dans l'ordre d'affichage (formulaire contrôlé : l'index
 * suit le réordonnancement) — l'ordre du tableau fait foi pour `ordre`.
 */
export function parseModificationFormData(formData: FormData) {
  const series = [];
  for (let i = 0; formData.has(`series.${i}.repetitions`); i++) {
    const consigne = String(formData.get(`series.${i}.consigne`) ?? "").trim();
    series.push({
      repetitions: nombre(formData.get(`series.${i}.repetitions`)),
      distance_m: nombre(formData.get(`series.${i}.distance_m`)),
      type_nage: formData.get(`series.${i}.type_nage`),
      recuperation_s: nombre(formData.get(`series.${i}.recuperation_s`)),
      consigne: consigne === "" ? null : consigne,
    });
  }
  return {
    seanceId: formData.get("seance_id"),
    echauffement: {
      distance_m: nombre(formData.get("echauffement_distance_m")),
      consignes: String(formData.get("echauffement_consignes") ?? "").trim(),
    },
    series,
    retour_au_calme: {
      distance_m: nombre(formData.get("retour_calme_distance_m")),
      consignes: String(formData.get("retour_calme_consignes") ?? "").trim(),
    },
    commentaire: formData.get("commentaire") ?? "",
  };
}

/**
 * Messages d'erreur localisés du formulaire E-23, prêts à afficher :
 * « Série 2 : … », « Échauffement : … ». Les chemins Zod suivent la
 * structure de modificationSeanceSchema.
 */
export function formatErreursModification(error: z.ZodError): string[] {
  const SECTIONS: Record<string, string> = {
    echauffement: "Échauffement",
    retour_au_calme: "Retour au calme",
    commentaire: "Commentaire",
    seanceId: "Séance",
  };
  return error.issues.map((issue) => {
    const [racine, indice] = issue.path;
    if (racine === "series" && typeof indice === "number") {
      return `Série ${indice + 1} : ${issue.message}`;
    }
    const section = typeof racine === "string" ? SECTIONS[racine] : undefined;
    return section ? `${section} : ${issue.message}` : issue.message;
  });
}
