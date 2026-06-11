import { describe, expect, it } from "vitest";

import { DUREES, MATERIELS } from "@/features/profil/schemas";
import { buildSeanceGenereeSchema, materielsMentionnes } from "@/features/seances/schemas";
import { buildPromptUtilisateur, PROMPT_SYSTEME } from "@/server/llm/prompt";
import {
  construireSeanceSimulee,
  createClientLlmSimule,
  extraireDureeCibleMin,
} from "@/server/llm/providers/simule";
import type { ProfilPseudonymise } from "@/server/llm/types";

/**
 * Le pilote simulé (LLM_DRIVER=simule) alimente le dev local et les E2E :
 * sa sortie doit passer le VRAI schéma de validation C2 — sinon chaque
 * génération simulée échouerait en sortie_invalide.
 */

const profil = (dureeCibleMin: number): ProfilPseudonymise => ({
  reference: "11111111-2222-4333-8444-555555555555",
  niveau: "intermediaire",
  frequenceParSemaine: 3,
  dureeCibleMin,
  objectifs: ["endurance"],
  bassinM: 25,
  materiel: [],
});

describe("extraireDureeCibleMin", () => {
  it("retrouve la durée cible dans le prompt utilisateur réel (C2)", () => {
    for (const duree of DUREES) {
      expect(extraireDureeCibleMin(buildPromptUtilisateur(profil(duree)))).toBe(duree);
    }
  });

  it("retourne null si le format du prompt change", () => {
    expect(extraireDureeCibleMin("Durée cible : une heure")).toBeNull();
  });
});

describe("construireSeanceSimulee", () => {
  it.each(DUREES.map((d) => [d]))(
    "produit une séance valide pour le schéma C2 (durée %i min, sans matériel)",
    (duree) => {
      const seance = construireSeanceSimulee(duree);
      const schema = buildSeanceGenereeSchema({
        dureeCibleMin: duree,
        materielDisponible: [],
      });
      const resultat = schema.safeParse(seance);
      expect(resultat.error?.issues ?? []).toEqual([]);
      expect(resultat.success).toBe(true);
    },
  );

  it("ne mentionne jamais de matériel (compatible avec tout profil)", () => {
    for (const duree of DUREES) {
      const seance = construireSeanceSimulee(duree);
      const textes = [
        seance.echauffement.consignes,
        seance.retour_au_calme.consignes,
        ...seance.corps.map((s) => s.consigne ?? ""),
      ].join("\n");
      expect(materielsMentionnes(textes)).toEqual([]);
      expect(MATERIELS.every((materiel) => !textes.includes(materiel))).toBe(true);
    }
  });
});

describe("createClientLlmSimule", () => {
  it("répond un JSON parsable, dimensionné sur le prompt, avec des tokens comptés (RG-22)", async () => {
    const client = createClientLlmSimule();
    const reponse = await client.generer({
      systeme: PROMPT_SYSTEME,
      utilisateur: buildPromptUtilisateur(profil(90)),
    });
    const seance = JSON.parse(reponse.texte);
    expect(seance.duree_estimee_min).toBe(90);
    expect(reponse.tokensEntree).toBeGreaterThan(0);
    expect(reponse.tokensSortie).toBeGreaterThan(0);
  });
});
