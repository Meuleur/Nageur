import { z } from "zod";

/**
 * Schémas Zod de l'espace admin (E-31 à E-33) — source unique, appliquée
 * côté client (UX) ET revalidée côté serveur dans les actions (D2).
 */

export const FOURNISSEURS_LLM = ["anthropic", "openai"] as const;
export type FournisseurAdmin = (typeof FOURNISSEURS_LLM)[number];

export const fournisseurSchema = z.enum(FOURNISSEURS_LLM, "Fournisseur inconnu.");

/** Garde-fou de saisie : une vraie clé API fait toujours plus de 20 caractères. */
export const CLE_API_MIN = 20;
export const CLE_API_MAX = 200;

export const cleApiSchema = z.object({
  fournisseur: fournisseurSchema,
  cle: z
    .string("Clé requise.")
    .trim()
    .min(CLE_API_MIN, `Au moins ${CLE_API_MIN} caractères.`)
    .max(CLE_API_MAX, `Au plus ${CLE_API_MAX} caractères.`),
});

export const MODELE_MAX = 100;

export const modeleSchema = z.object({
  fournisseur: fournisseurSchema,
  modele: z
    .string("Modèle requis.")
    .trim()
    .min(2, "Modèle requis.")
    .max(MODELE_MAX, `Au plus ${MODELE_MAX} caractères.`)
    .regex(/^[\w.:-]+$/, "Identifiant de modèle invalide."),
});

export const activationSchema = z.object({ fournisseur: fournisseurSchema });

/** E-32 : coachId vide = désaffectation (RG-13). */
export const affectationSchema = z.object({
  nageurId: z.uuid("Nageur invalide."),
  coachId: z
    .union([z.uuid("Coach invalide."), z.literal("")])
    .transform((valeur) => (valeur === "" ? null : valeur)),
});

const nomSchema = (label: string) =>
  z.string(`${label} requis.`).trim().min(1, `${label} requis.`).max(50, "Au plus 50 caractères.");

/** E-33 : invitation d'un coach (RG-02) — l'admin ne saisit JAMAIS de mot de passe. */
export const invitationCoachSchema = z.object({
  prenom: nomSchema("Prénom"),
  nom: nomSchema("Nom"),
  email: z
    .string("Adresse e-mail requise.")
    .trim()
    .toLowerCase()
    .max(254, "Adresse e-mail trop longue.")
    .pipe(z.email("Adresse e-mail invalide.")),
});
