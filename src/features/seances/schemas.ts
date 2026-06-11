import { z } from "zod";

import { MATERIELS, type Materiel } from "@/features/profil/schemas";

/**
 * Schéma Zod de la séance générée (C2/A4) — source unique : il valide la
 * sortie structurée du LLM avant persistance (CH4) et resservira aux écrans
 * nageur/coach (CH5/CH6). Énums conformes à E1 (type_nage en base).
 */

export const TYPES_NAGE = ["crawl", "dos", "brasse", "papillon", "quatre_nages"] as const;
export type TypeNage = (typeof TYPES_NAGE)[number];

/**
 * ADR-019 exige une durée estimée « proche de la durée cible » sans fixer de
 * marge : tolérance retenue à l'implémentation = ±20 % de la cible.
 */
export const TOLERANCE_DUREE_RATIO = 0.2;

const distanceSchema = (message: string) =>
  z
    .number(message)
    .int(message)
    .min(0, message)
    .multipleOf(25, "Les distances doivent être des multiples de 25 m.");

const blocSchema = z.object({
  distance_m: distanceSchema("Distance du bloc invalide."),
  consignes: z.string("Consignes du bloc invalides."),
});

export const serieGenereeSchema = z.object({
  repetitions: z.number("Répétitions invalides.").int().min(1, "Au moins une répétition."),
  distance_m: distanceSchema("Distance de série invalide.").refine(
    (d) => d > 0,
    "La distance d'une série doit être positive.",
  ),
  type_nage: z.enum(TYPES_NAGE, "Type de nage hors énumération."),
  recuperation_s: z
    .number("Récupération invalide.")
    .int()
    .min(0, "La récupération ne peut pas être négative."),
  consigne: z.string("Consigne invalide.").nullish(),
});

export type SerieGeneree = z.output<typeof serieGenereeSchema>;

/** Somme échauffement + corps (répétitions × distance) + retour au calme. */
export function distanceTotaleCalculee(seance: {
  echauffement: { distance_m: number };
  corps: { repetitions: number; distance_m: number }[];
  retour_au_calme: { distance_m: number };
}): number {
  const corps = seance.corps.reduce((total, s) => total + s.repetitions * s.distance_m, 0);
  return seance.echauffement.distance_m + corps + seance.retour_au_calme.distance_m;
}

/**
 * Détection du matériel cité dans un texte libre (consignes). La sortie C2
 * ne structure pas le matériel : la règle « matériel utilisé ⊆ matériel
 * disponible » se vérifie donc sur les mentions textuelles de l'énum E1.
 */
const MOTIFS_MATERIEL: Record<Materiel, RegExp> = {
  plaquettes: /\bplaquettes?\b/i,
  pull_buoy: /\bpull[\s_-]?buoys?\b/i,
  palmes: /\bpalmes?\b/i,
  planche: /\bplanches?\b/i,
  tuba: /\btubas?\b/i,
};

export function materielsMentionnes(texte: string): Materiel[] {
  return MATERIELS.filter((materiel) => MOTIFS_MATERIEL[materiel].test(texte));
}

export type ContraintesGeneration = {
  /** Durée cible du profil (minutes, liste fermée A4). */
  dureeCibleMin: number;
  /** Matériel déclaré dans le profil — seule liste autorisée dans la séance. */
  materielDisponible: readonly Materiel[];
};

/**
 * Schéma complet de validation d'une sortie LLM (C2) : structure, types,
 * distances multiples de 25 m, distance totale cohérente avec la somme,
 * durée estimée proche de la cible, matériel utilisé ⊆ matériel disponible.
 * Toute non-conformité déclenche la stratégie d'erreur C2 (une relance).
 */
export function buildSeanceGenereeSchema(contraintes: ContraintesGeneration) {
  return z
    .object({
      echauffement: blocSchema,
      corps: z
        .array(serieGenereeSchema, "Corps de séance invalide.")
        .min(1, "Le corps de séance doit contenir au moins une série."),
      retour_au_calme: blocSchema,
      distance_totale_m: z.number("Distance totale invalide.").int().positive(),
      duree_estimee_min: z.number("Durée estimée invalide.").int().positive(),
    })
    .superRefine((seance, ctx) => {
      const somme = distanceTotaleCalculee(seance);
      if (seance.distance_totale_m !== somme) {
        ctx.addIssue({
          code: "custom",
          path: ["distance_totale_m"],
          message: `Distance totale incohérente : annoncée ${seance.distance_totale_m} m, somme ${somme} m.`,
        });
      }

      const ecartMax = Math.round(contraintes.dureeCibleMin * TOLERANCE_DUREE_RATIO);
      if (Math.abs(seance.duree_estimee_min - contraintes.dureeCibleMin) > ecartMax) {
        ctx.addIssue({
          code: "custom",
          path: ["duree_estimee_min"],
          message: `Durée estimée trop éloignée de la cible de ${contraintes.dureeCibleMin} min (tolérance ±${ecartMax} min).`,
        });
      }

      const textes = [
        seance.echauffement.consignes,
        seance.retour_au_calme.consignes,
        ...seance.corps.map((s) => s.consigne ?? ""),
      ];
      const interdits = materielsMentionnes(textes.join("\n")).filter(
        (materiel) => !contraintes.materielDisponible.includes(materiel),
      );
      if (interdits.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["corps"],
          message: `Matériel non disponible dans le profil : ${interdits.join(", ")}.`,
        });
      }
    });
}

export type SeanceGeneree = z.output<ReturnType<typeof buildSeanceGenereeSchema>>;
