import type { Materiel, Niveau, Objectif } from "@/features/profil/schemas";

import type { ProfilPseudonymise } from "./types";

/**
 * Champs du profil sportif utiles à la génération (E1 swimmer_profiles).
 * La source peut porter d'autres champs (jointures, lignes brutes…) : seule
 * la liste blanche ci-dessous est recopiée.
 */
export type ProfilSportifSource = {
  niveau: Niveau;
  frequence: number;
  duree: number;
  bassin: number;
  objectifs: Objectif[];
  materiel: Materiel[];
};

/**
 * Construction du payload pseudonymisé (ADR-008/019) par liste blanche
 * stricte : nom, e-mail et disponibilités ne peuvent pas fuiter, même si la
 * source les contient. La référence opaque est fournie par l'appelant (uuid
 * aléatoire par génération).
 */
export function buildProfilPseudonymise(
  source: ProfilSportifSource,
  reference: string,
): ProfilPseudonymise {
  return {
    reference,
    niveau: source.niveau,
    frequenceParSemaine: source.frequence,
    dureeCibleMin: source.duree,
    objectifs: [...source.objectifs],
    bassinM: source.bassin,
    materiel: [...source.materiel],
  };
}
