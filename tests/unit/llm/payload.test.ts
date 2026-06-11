import { describe, expect, it } from "vitest";

import { buildProfilPseudonymise, type ProfilSportifSource } from "@/server/llm/payload";
import { buildPromptRelance, buildPromptUtilisateur, PROMPT_SYSTEME } from "@/server/llm/prompt";

/**
 * Source volontairement « sale » : elle porte des données identifiantes et
 * les disponibilités, comme une ligne jointe profiles + swimmer_profiles +
 * swimmer_availabilities. La pseudonymisation doit tout ignorer (ADR-008,
 * disponibilités exclues par ADR-019).
 */
const SOURCE_AVEC_IDENTITE = {
  niveau: "intermediaire",
  frequence: 3,
  duree: 60,
  bassin: 25,
  objectifs: ["endurance", "technique"],
  materiel: ["pull_buoy"],
  prenom: "Léa",
  nom: "Petit",
  email: "lea.nageur@nageur.test",
  disponibilites: [{ jour: 1, moment: "matin" }],
} as ProfilSportifSource;

const REFERENCE = "11111111-2222-4333-8444-555555555555";

describe("buildProfilPseudonymise (ADR-008/RG-20)", () => {
  it("ne recopie que la liste blanche d'attributs sportifs", () => {
    const payload = buildProfilPseudonymise(SOURCE_AVEC_IDENTITE, REFERENCE);
    expect(Object.keys(payload).sort()).toEqual([
      "bassinM",
      "dureeCibleMin",
      "frequenceParSemaine",
      "materiel",
      "niveau",
      "objectifs",
      "reference",
    ]);
  });

  it("ne transmet ni identité ni disponibilités, même présentes dans la source", () => {
    const serialise = JSON.stringify(buildProfilPseudonymise(SOURCE_AVEC_IDENTITE, REFERENCE));
    expect(serialise).not.toContain("Léa");
    expect(serialise).not.toContain("Petit");
    expect(serialise).not.toContain("lea.nageur");
    expect(serialise).not.toContain("disponibilites");
    expect(serialise).not.toContain("matin");
  });
});

describe("prompts (C2)", () => {
  const payload = buildProfilPseudonymise(SOURCE_AVEC_IDENTITE, REFERENCE);

  it("le prompt utilisateur décrit les attributs sportifs en français", () => {
    const prompt = buildPromptUtilisateur(payload);
    expect(prompt).toContain("Intermédiaire");
    expect(prompt).toContain("3 séance(s) par semaine");
    expect(prompt).toContain("60 minutes");
    expect(prompt).toContain("Endurance");
    expect(prompt).toContain("25 m");
    expect(prompt).toContain("Pull-buoy");
  });

  it("aucun prompt ne contient l'identité, les disponibilités ni la référence opaque", () => {
    for (const prompt of [
      PROMPT_SYSTEME,
      buildPromptUtilisateur(payload),
      buildPromptRelance(payload, ["distance_totale_m : incohérente"]),
    ]) {
      expect(prompt).not.toContain("Léa");
      expect(prompt).not.toContain("lea.nageur");
      expect(prompt.toLowerCase()).not.toContain("disponibilit");
      expect(prompt).not.toContain(REFERENCE);
    }
  });

  it("le prompt utilisateur indique « aucun » matériel quand la liste est vide", () => {
    const sansMateriel = buildProfilPseudonymise(
      { ...SOURCE_AVEC_IDENTITE, materiel: [] },
      REFERENCE,
    );
    expect(buildPromptUtilisateur(sansMateriel)).toContain("Matériel disponible : aucun");
  });

  it("le prompt de relance reprend les non-conformités", () => {
    const relance = buildPromptRelance(payload, ["durée estimée trop éloignée"]);
    expect(relance).toContain("invalide");
    expect(relance).toContain("durée estimée trop éloignée");
  });
});
