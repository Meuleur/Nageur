import { z } from "zod";

import { creneauFromKey } from "./creneaux";

/**
 * Schémas Zod du profil sportif (E-11, A4) — source unique, appliquée côté
 * client (UX) ET côté serveur (sécurité, D2). Énums conformes à E1 ; champs
 * obligatoires : niveau, fréquence, durée, objectifs, bassin (ADR-016) ;
 * matériel et disponibilités facultatifs.
 */

export const NIVEAUX = ["debutant", "intermediaire", "confirme", "competition"] as const;
export type Niveau = (typeof NIVEAUX)[number];

export const OBJECTIFS = [
  "endurance",
  "competition",
  "perte_poids",
  "technique",
  "loisir",
] as const;
export type Objectif = (typeof OBJECTIFS)[number];

export const MATERIELS = ["plaquettes", "pull_buoy", "palmes", "planche", "tuba"] as const;
export type Materiel = (typeof MATERIELS)[number];

/** Liste fermée des durées, en minutes (A4/ADR-015). */
export const DUREES = [30, 45, 60, 75, 90, 120] as const;

export const BASSINS = [25, 50] as const;

export const FREQUENCE_MIN = 1;
export const FREQUENCE_MAX = 7;

const unique = <T>(valeurs: T[]) => [...new Set(valeurs)];

/**
 * Formulaire E-11 : les valeurs arrivent en chaînes (FormData) ; les énums
 * fermées valident puis les champs numériques sont convertis. Sortie prête
 * pour `swimmer_profiles` + `swimmer_availabilities` (E1).
 */
export const profilSportifSchema = z.object({
  niveau: z.enum(NIVEAUX, "Choisissez votre niveau."),
  frequence: z
    .enum(["1", "2", "3", "4", "5", "6", "7"], "Choisissez votre fréquence d'entraînement.")
    .transform(Number),
  duree: z
    .enum(["30", "45", "60", "75", "90", "120"], "Choisissez votre durée habituelle de séance.")
    .transform(Number),
  objectifs: z
    .array(z.enum(OBJECTIFS, "Objectif invalide."), "Choisissez au moins un objectif.")
    .min(1, "Choisissez au moins un objectif.")
    .transform(unique),
  bassin: z.enum(["25", "50"], "Choisissez votre bassin habituel.").transform(Number),
  materiel: z
    .array(z.enum(MATERIELS, "Matériel invalide."), "Matériel invalide.")
    .transform(unique),
  disponibilites: z
    .array(
      z.string("Créneau invalide.").regex(/^[1-7]-(matin|midi|soir)$/, "Créneau invalide."),
      "Créneau invalide.",
    )
    .transform((cles) => unique(cles).map(creneauFromKey)),
});

export type ProfilSportif = z.output<typeof profilSportifSchema>;

/**
 * Extraction des champs E-11 depuis le FormData (multi-valués via getAll) —
 * même mapping côté client (validation avant envoi) et côté serveur (action).
 */
export function parseProfilFormData(formData: FormData) {
  return {
    niveau: formData.get("niveau"),
    frequence: formData.get("frequence"),
    duree: formData.get("duree"),
    objectifs: formData.getAll("objectifs"),
    bassin: formData.get("bassin"),
    materiel: formData.getAll("materiel"),
    disponibilites: formData.getAll("disponibilites"),
  };
}
