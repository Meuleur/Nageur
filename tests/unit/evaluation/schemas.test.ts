import { describe, expect, it } from "vitest";

import {
  autoEvaluationSchema,
  COMMENTAIRE_MAX,
  parseAutoEvaluationFormData,
} from "@/features/evaluation/schemas";

const SEANCE_ID = "40000000-0000-4000-8000-000000000002";

const valide = {
  seanceId: SEANCE_ID,
  ressenti: "4",
  difficulte: "6",
  commentaire: "Bien passé.",
};

describe("autoEvaluationSchema (E-15, RG-34)", () => {
  it("accepte une auto-évaluation complète et convertit les nombres", () => {
    const parsed = autoEvaluationSchema.parse(valide);
    expect(parsed).toEqual({
      seanceId: SEANCE_ID,
      ressenti: 4,
      difficulte: 6,
      commentaire: "Bien passé.",
    });
  });

  it("ressenti obligatoire, borné 1–5", () => {
    expect(autoEvaluationSchema.safeParse({ ...valide, ressenti: null }).success).toBe(false);
    expect(autoEvaluationSchema.safeParse({ ...valide, ressenti: "0" }).success).toBe(false);
    expect(autoEvaluationSchema.safeParse({ ...valide, ressenti: "6" }).success).toBe(false);
    expect(autoEvaluationSchema.parse({ ...valide, ressenti: "1" }).ressenti).toBe(1);
    expect(autoEvaluationSchema.parse({ ...valide, ressenti: "5" }).ressenti).toBe(5);
  });

  it("difficulté facultative (null), bornée 1–10", () => {
    expect(autoEvaluationSchema.parse({ ...valide, difficulte: null }).difficulte).toBeNull();
    expect(autoEvaluationSchema.safeParse({ ...valide, difficulte: "0" }).success).toBe(false);
    expect(autoEvaluationSchema.safeParse({ ...valide, difficulte: "11" }).success).toBe(false);
    expect(autoEvaluationSchema.parse({ ...valide, difficulte: "10" }).difficulte).toBe(10);
  });

  it("commentaire facultatif : vide → null, espaces purgés, longueur bornée", () => {
    expect(autoEvaluationSchema.parse({ ...valide, commentaire: "" }).commentaire).toBeNull();
    expect(autoEvaluationSchema.parse({ ...valide, commentaire: "   " }).commentaire).toBeNull();
    expect(
      autoEvaluationSchema.safeParse({
        ...valide,
        commentaire: "a".repeat(COMMENTAIRE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("rejette une référence de séance non uuid", () => {
    expect(autoEvaluationSchema.safeParse({ ...valide, seanceId: "abc" }).success).toBe(false);
  });
});

describe("parseAutoEvaluationFormData (mapping FormData, client + serveur)", () => {
  it("extrait les champs du formulaire E-15", () => {
    const formData = new FormData();
    formData.set("seance_id", SEANCE_ID);
    formData.set("ressenti", "3");
    formData.set("difficulte", "8");
    formData.set("commentaire", "Dur sur la fin.");
    expect(parseAutoEvaluationFormData(formData)).toEqual({
      seanceId: SEANCE_ID,
      ressenti: "3",
      difficulte: "8",
      commentaire: "Dur sur la fin.",
    });
  });

  it("difficulté absente ou « non précisée » (vide) → null ; commentaire absent → chaîne vide", () => {
    const formData = new FormData();
    formData.set("seance_id", SEANCE_ID);
    formData.set("ressenti", "3");
    expect(parseAutoEvaluationFormData(formData)).toEqual({
      seanceId: SEANCE_ID,
      ressenti: "3",
      difficulte: null,
      commentaire: "",
    });

    formData.set("difficulte", "");
    expect(parseAutoEvaluationFormData(formData).difficulte).toBeNull();
  });

  it("le tout passe le schéma : une soumission minimale est valide", () => {
    const formData = new FormData();
    formData.set("seance_id", SEANCE_ID);
    formData.set("ressenti", "2");
    const parsed = autoEvaluationSchema.parse(parseAutoEvaluationFormData(formData));
    expect(parsed).toEqual({
      seanceId: SEANCE_ID,
      ressenti: 2,
      difficulte: null,
      commentaire: null,
    });
  });
});
