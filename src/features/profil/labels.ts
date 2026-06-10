import type { Moment } from "./creneaux";
import type { Materiel, Niveau, Objectif } from "./schemas";

/**
 * Libellés français des énums du profil (A4) — le métier est en français
 * dans l'UI, les valeurs stockées restent celles de E1 (D2/ADR-022).
 */

export const NIVEAU_LABELS: Record<Niveau, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  confirme: "Confirmé",
  competition: "Compétition",
};

export const OBJECTIF_LABELS: Record<Objectif, string> = {
  endurance: "Endurance",
  competition: "Compétition",
  perte_poids: "Perte de poids / remise en forme",
  technique: "Technique",
  loisir: "Loisir / bien-être",
};

export const MATERIEL_LABELS: Record<Materiel, string> = {
  plaquettes: "Plaquettes",
  pull_buoy: "Pull-buoy",
  palmes: "Palmes",
  planche: "Planche",
  tuba: "Tuba",
};

/** Durées affichées (A4) : 30 min / 45 min / 1 h / 1 h 15 / 1 h 30 / 2 h. */
export const DUREE_LABELS: Record<number, string> = {
  30: "30 min",
  45: "45 min",
  60: "1 h",
  75: "1 h 15",
  90: "1 h 30",
  120: "2 h",
};

export const BASSIN_LABELS: Record<number, string> = {
  25: "25 m",
  50: "50 m",
};

export const MOMENT_LABELS: Record<Moment, string> = {
  matin: "Matin",
  midi: "Midi",
  soir: "Soir",
};

/** Jours de la grille — index = jour E1 (1 = lundi … 7 = dimanche). */
export const JOUR_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};
