import { describe, expect, it } from "vitest";

import { creneauFromKey, creneauKey, diffCreneaux, type Creneau } from "@/features/profil/creneaux";

describe("creneauKey / creneauFromKey", () => {
  it("fait l'aller-retour clé ↔ créneau (grille E-11)", () => {
    const creneau: Creneau = { jour: 3, moment: "soir" };
    expect(creneauKey(creneau)).toBe("3-soir");
    expect(creneauFromKey("3-soir")).toEqual(creneau);
  });
});

describe("diffCreneaux — unicité (nageur_id, jour, moment) par construction (E1)", () => {
  const lundiMatin: Creneau = { jour: 1, moment: "matin" };
  const mardiMidi: Creneau = { jour: 2, moment: "midi" };
  const dimancheSoir: Creneau = { jour: 7, moment: "soir" };

  it("premier enregistrement : tout est à ajouter, rien à supprimer", () => {
    expect(diffCreneaux([], [lundiMatin, mardiMidi])).toEqual({
      aAjouter: [lundiMatin, mardiMidi],
      aSupprimer: [],
    });
  });

  it("grille vidée : tout est à supprimer", () => {
    expect(diffCreneaux([lundiMatin, mardiMidi], [])).toEqual({
      aAjouter: [],
      aSupprimer: [lundiMatin, mardiMidi],
    });
  });

  it("ajout et retrait combinés : un créneau conservé n'est jamais réinséré", () => {
    const { aAjouter, aSupprimer } = diffCreneaux(
      [lundiMatin, mardiMidi],
      [mardiMidi, dimancheSoir],
    );
    expect(aAjouter).toEqual([dimancheSoir]);
    expect(aSupprimer).toEqual([lundiMatin]);
  });

  it("aucun changement : diff vide", () => {
    expect(diffCreneaux([lundiMatin], [lundiMatin])).toEqual({ aAjouter: [], aSupprimer: [] });
  });

  it("ignore les doublons dans les créneaux demandés", () => {
    const { aAjouter } = diffCreneaux([], [lundiMatin, { jour: 1, moment: "matin" }]);
    expect(aAjouter).toEqual([lundiMatin]);
  });
});
