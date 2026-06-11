import { describe, expect, it } from "vitest";

import {
  formatTauxValidation,
  metriquesAdminSchema,
  tauxValidation,
} from "@/features/admin/metriques";

const METRIQUES_VALIDES = {
  comptes: { coachs: 11, nageurs: 24, nageurs_sans_coach: 3 },
  seances: { generees: 29, validees: 7, modifiees: 5, refusees: 7, en_attente: 10 },
  tokens: { total: 33730, anthropic: 27960, openai: 5770 },
  par_fournisseur: { anthropic: 23, openai: 6 },
  serie_generees_30j: [{ jour: "2026-06-11", generees: 2 }],
};

describe("métriques admin (E-30, RG-39)", () => {
  it("valide la forme du jsonb d'admin_metrics", () => {
    expect(metriquesAdminSchema.parse(METRIQUES_VALIDES)).toEqual(METRIQUES_VALIDES);
  });

  it("rejette un agrégat manquant ou négatif (D2 : pas de confiance implicite)", () => {
    expect(() =>
      metriquesAdminSchema.parse({ ...METRIQUES_VALIDES, tokens: { total: -1 } }),
    ).toThrow();
    expect(() => metriquesAdminSchema.parse({})).toThrow();
  });

  it("taux de validation C4 : (validées + modifiées) / générées", () => {
    expect(tauxValidation(METRIQUES_VALIDES.seances)).toBeCloseTo(12 / 29);
    expect(formatTauxValidation(tauxValidation(METRIQUES_VALIDES.seances))).toBe("41 %");
  });

  it("aucune génération sur la période → taux null, affiché « — »", () => {
    const seances = { ...METRIQUES_VALIDES.seances, generees: 0 };
    expect(tauxValidation(seances)).toBeNull();
    expect(formatTauxValidation(null)).toBe("—");
  });
});
