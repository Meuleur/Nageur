/**
 * Grille de disponibilités (A4/ADR-016) : 7 jours (1 = lundi … 7 = dimanche)
 * × 3 moments (matin/midi/soir), une ligne `swimmer_availabilities` par
 * créneau coché (E1). Module pur, partagé client/serveur et testé unitairement.
 */
export const MOMENTS = ["matin", "midi", "soir"] as const;
export type Moment = (typeof MOMENTS)[number];

export const JOURS = [1, 2, 3, 4, 5, 6, 7] as const;

export type Creneau = { jour: number; moment: Moment };

/** Clé stable d'un créneau — valeur des cases de la grille (E-11). */
export function creneauKey(creneau: Creneau): string {
  return `${creneau.jour}-${creneau.moment}`;
}

/** Inverse de `creneauKey` — la clé doit avoir été validée (schéma Zod). */
export function creneauFromKey(key: string): Creneau {
  const [jour, moment] = key.split("-");
  return { jour: Number(jour), moment: moment as Moment };
}

/**
 * Diff entre les créneaux enregistrés et les créneaux cochés : lignes à
 * insérer et à supprimer. Un créneau déjà présent n'est jamais réinséré et
 * les doublons sont ignorés — l'unicité (nageur_id, jour, moment) de E1 est
 * respectée par construction.
 */
export function diffCreneaux(
  existants: readonly Creneau[],
  voulus: readonly Creneau[],
): { aAjouter: Creneau[]; aSupprimer: Creneau[] } {
  const clesExistantes = new Set(existants.map(creneauKey));
  const clesVoulues = new Set(voulus.map(creneauKey));

  const aAjouter: Creneau[] = [];
  for (const creneau of voulus) {
    const cle = creneauKey(creneau);
    if (!clesExistantes.has(cle) && !aAjouter.some((c) => creneauKey(c) === cle)) {
      aAjouter.push(creneau);
    }
  }
  const aSupprimer = existants.filter((c) => !clesVoulues.has(creneauKey(c)));
  return { aAjouter, aSupprimer };
}
