import type { TypeNage } from "./schemas";

/**
 * Libellés français des séances (A4/B2) — métier en français dans l'UI,
 * valeurs stockées E1 (D2/ADR-022).
 */

export const TYPE_NAGE_LABELS: Record<TypeNage, string> = {
  crawl: "Crawl",
  dos: "Dos",
  brasse: "Brasse",
  papillon: "Papillon",
  quatre_nages: "4 nages",
};

/** « 1 250 m » — espace insécable fine entre milliers, unité collée par espace. */
export function formatDistance(distanceM: number): string {
  return `${distanceM.toLocaleString("fr-FR")} m`;
}

/** « 1 h », « 45 min », « 1 h 15 » — même convention que DUREE_LABELS (E-11). */
export function formatDuree(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) {
    return `${reste} min`;
  }
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, "0")}`;
}

/** « lundi 8 juin 2026 » — date de génération affichée en liste et détail. */
export function formatDateSeance(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(isoDate));
}
