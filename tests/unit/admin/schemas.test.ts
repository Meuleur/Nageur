import { describe, expect, it } from "vitest";

import {
  affectationSchema,
  cleApiSchema,
  invitationCoachSchema,
  modeleSchema,
} from "@/features/admin/schemas";

const NAGEUR_ID = "30000000-0000-4000-8000-000000000001";
const COACH_ID = "20000000-0000-4000-8000-000000000001";

describe("schémas admin (E-31 à E-33)", () => {
  it("clé API : fournisseur connu + longueur plausible, espaces rognés", () => {
    const ok = cleApiSchema.parse({
      fournisseur: "anthropic",
      cle: "  sk-ant-une-cle-suffisamment-longue  ",
    });
    expect(ok.cle).toBe("sk-ant-une-cle-suffisamment-longue");

    expect(cleApiSchema.safeParse({ fournisseur: "anthropic", cle: "courte" }).success).toBe(
      false,
    );
    expect(
      cleApiSchema.safeParse({ fournisseur: "mistral", cle: "x".repeat(30) }).success,
    ).toBe(false);
  });

  it("modèle : identifiant simple uniquement (pas d'espace ni de caractère exotique)", () => {
    expect(modeleSchema.parse({ fournisseur: "anthropic", modele: "claude-opus-4-8" }).modele).toBe(
      "claude-opus-4-8",
    );
    expect(modeleSchema.safeParse({ fournisseur: "openai", modele: "gpt 4o" }).success).toBe(
      false,
    );
    expect(modeleSchema.safeParse({ fournisseur: "openai", modele: "" }).success).toBe(false);
  });

  it("affectation : coachId vide → null (désaffectation, RG-13)", () => {
    expect(affectationSchema.parse({ nageurId: NAGEUR_ID, coachId: COACH_ID })).toEqual({
      nageurId: NAGEUR_ID,
      coachId: COACH_ID,
    });
    expect(affectationSchema.parse({ nageurId: NAGEUR_ID, coachId: "" })).toEqual({
      nageurId: NAGEUR_ID,
      coachId: null,
    });
    expect(affectationSchema.safeParse({ nageurId: "pas-un-uuid", coachId: "" }).success).toBe(
      false,
    );
  });

  it("invitation coach : identité bornée, e-mail normalisé en minuscules", () => {
    const ok = invitationCoachSchema.parse({
      prenom: " Sacha ",
      nom: "Royer",
      email: "Sacha.COACH@Nageur.test",
    });
    expect(ok).toEqual({ prenom: "Sacha", nom: "Royer", email: "sacha.coach@nageur.test" });

    expect(
      invitationCoachSchema.safeParse({ prenom: "", nom: "Royer", email: "a@b.test" }).success,
    ).toBe(false);
    expect(
      invitationCoachSchema.safeParse({ prenom: "S", nom: "R", email: "pas-un-email" }).success,
    ).toBe(false);
  });
});
