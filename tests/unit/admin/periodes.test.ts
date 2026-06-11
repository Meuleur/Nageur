import { describe, expect, it } from "vitest";

import { depuisPourPeriode, periodeDepuisParam, PERIODES } from "@/features/admin/periodes";

const MAINTENANT = new Date("2026-06-11T12:00:00.000Z");

describe("périodes du tableau de bord (E-30, C4)", () => {
  it("fenêtres glissantes : jour = 24 h, semaine = 7 j, mois = 30 j", () => {
    expect(depuisPourPeriode("jour", MAINTENANT)?.toISOString()).toBe("2026-06-10T12:00:00.000Z");
    expect(depuisPourPeriode("semaine", MAINTENANT)?.toISOString()).toBe(
      "2026-06-04T12:00:00.000Z",
    );
    expect(depuisPourPeriode("mois", MAINTENANT)?.toISOString()).toBe("2026-05-12T12:00:00.000Z");
  });

  it("total : aucune borne (null)", () => {
    expect(depuisPourPeriode("total", MAINTENANT)).toBeNull();
  });

  it("searchParams → période sûre, défaut total", () => {
    for (const periode of PERIODES) {
      expect(periodeDepuisParam(periode)).toBe(periode);
    }
    expect(periodeDepuisParam(undefined)).toBe("total");
    expect(periodeDepuisParam("n-importe-quoi")).toBe("total");
    expect(periodeDepuisParam(["jour"])).toBe("total");
  });
});
