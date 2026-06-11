import { describe, expect, it } from "vitest";

import { STATUTS_SEANCE } from "@/features/seances/statuts";
import { peutEtreTraitee, STATUT_CIBLE_PAR_DECISION } from "@/features/validation/transitions";

describe("transitions de traitement (A3, RG-26/RG-30)", () => {
  it("seule une séance en attente peut être traitée", () => {
    expect(peutEtreTraitee("en_attente")).toBe(true);
    expect(peutEtreTraitee("validee")).toBe(false);
    expect(peutEtreTraitee("modifiee")).toBe(false);
    expect(peutEtreTraitee("refusee")).toBe(false);
  });

  it("chaque décision cible un statut terminal (T2/T4)", () => {
    expect(STATUT_CIBLE_PAR_DECISION.valider).toBe("validee");
    expect(STATUT_CIBLE_PAR_DECISION.refuser).toBe("refusee");
    for (const statut of Object.values(STATUT_CIBLE_PAR_DECISION)) {
      expect(STATUTS_SEANCE).toContain(statut);
      expect(peutEtreTraitee(statut)).toBe(false);
    }
  });
});
