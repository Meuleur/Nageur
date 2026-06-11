/**
 * Filtre de période du tableau de bord (E-30, C4) — fenêtres GLISSANTES :
 * jour = 24 dernières heures, semaine = 7 jours, mois = 30 jours,
 * total = depuis toujours. Module pur, partagé par l'écran, l'action de
 * lecture et les tests.
 */

export const PERIODES = ["jour", "semaine", "mois", "total"] as const;
export type Periode = (typeof PERIODES)[number];

export const PERIODE_LABELS: Record<Periode, string> = {
  jour: "24 heures",
  semaine: "7 jours",
  mois: "30 jours",
  total: "Depuis le début",
};

const PERIODE_JOURS: Record<Periode, number | null> = {
  jour: 1,
  semaine: 7,
  mois: 30,
  total: null,
};

/** Borne basse de la période (null = pas de filtre, « total »). */
export function depuisPourPeriode(periode: Periode, maintenant: Date): Date | null {
  const jours = PERIODE_JOURS[periode];
  if (jours === null) {
    return null;
  }
  return new Date(maintenant.getTime() - jours * 24 * 60 * 60 * 1000);
}

/** searchParams → période sûre (défaut : total, RG-39). */
export function periodeDepuisParam(valeur: unknown): Periode {
  return PERIODES.includes(valeur as Periode) ? (valeur as Periode) : "total";
}
