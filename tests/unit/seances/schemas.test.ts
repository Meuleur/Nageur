import { describe, expect, it } from "vitest";

import {
  buildSeanceGenereeSchema,
  distanceTotaleCalculee,
  materielsMentionnes,
} from "@/features/seances/schemas";

const CONTRAINTES = {
  dureeCibleMin: 60,
  materielDisponible: ["pull_buoy", "planche"] as const,
};

const seanceValide = () => ({
  echauffement: { distance_m: 300, consignes: "Crawl souple, amplitude." },
  corps: [
    {
      repetitions: 4,
      distance_m: 100,
      type_nage: "crawl",
      recuperation_s: 30,
      consigne: "Allure régulière, respiration 3 temps.",
    },
    {
      repetitions: 8,
      distance_m: 50,
      type_nage: "dos",
      recuperation_s: 20,
      consigne: null,
    },
  ],
  retour_au_calme: { distance_m: 200, consignes: "Nage libre très souple." },
  distance_totale_m: 1300,
  duree_estimee_min: 60,
});

describe("buildSeanceGenereeSchema (C2/A4)", () => {
  it("accepte une séance conforme", () => {
    const resultat = buildSeanceGenereeSchema(CONTRAINTES).safeParse(seanceValide());
    expect(resultat.success).toBe(true);
  });

  it("accepte une durée estimée dans la tolérance (±20 %)", () => {
    const seance = { ...seanceValide(), duree_estimee_min: 70 };
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(true);
  });

  it("refuse une distance de série non multiple de 25 m", () => {
    const seance = seanceValide();
    seance.corps[0].distance_m = 130;
    seance.distance_totale_m = distanceTotaleCalculee(seance);
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(false);
  });

  it("refuse un corps de séance vide", () => {
    const seance = { ...seanceValide(), corps: [], distance_totale_m: 500 };
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(false);
  });

  it("refuse une distance totale incohérente avec la somme", () => {
    const seance = { ...seanceValide(), distance_totale_m: 2000 };
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(false);
  });

  it("refuse une durée estimée trop éloignée de la cible", () => {
    const seance = { ...seanceValide(), duree_estimee_min: 90 };
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(false);
  });

  it("refuse un type de nage hors énumération E1", () => {
    const seance = seanceValide();
    (seance.corps[0] as { type_nage: string }).type_nage = "4_nages";
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(false);
  });

  it("refuse le matériel absent du profil (matériel utilisé ⊆ disponible)", () => {
    const seance = seanceValide();
    seance.corps[0].consigne = "Avec palmes, battements amples.";
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(false);
  });

  it("accepte le matériel déclaré dans le profil", () => {
    const seance = seanceValide();
    seance.corps[1].consigne = "Pull-buoy entre les jambes, planche pour les jambes.";
    expect(buildSeanceGenereeSchema(CONTRAINTES).safeParse(seance).success).toBe(true);
  });

  it("refuse une séance sans matériel disponible qui en mentionne", () => {
    const seance = seanceValide();
    const resultat = buildSeanceGenereeSchema({
      dureeCibleMin: 60,
      materielDisponible: [],
    }).safeParse({
      ...seance,
      echauffement: { distance_m: 300, consignes: "Échauffement avec tuba frontal." },
    });
    expect(resultat.success).toBe(false);
  });
});

describe("materielsMentionnes", () => {
  it("détecte les mentions de l'énum E1, accents et variantes comprises", () => {
    expect(materielsMentionnes("Pull buoy serré, puis PLAQUETTES aux 100 m")).toEqual([
      "plaquettes",
      "pull_buoy",
    ]);
    expect(materielsMentionnes("Battements avec planche")).toEqual(["planche"]);
    expect(materielsMentionnes("Crawl en amplitude, sans accessoire")).toEqual([]);
  });
});

describe("distanceTotaleCalculee", () => {
  it("additionne échauffement, corps (répétitions × distance) et retour au calme", () => {
    expect(distanceTotaleCalculee(seanceValide())).toBe(1300);
  });
});
