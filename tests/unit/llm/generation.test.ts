import { describe, expect, it } from "vitest";

import { GenerationSeanceError } from "@/server/llm/errors";
import {
  genererSeanceAvecDeps,
  type ContexteNageur,
  type DepsGeneration,
  type EvenementLlm,
  type SeanceAPersister,
} from "@/server/llm/generation";
import type { RequeteFournisseur, ReponseFournisseur } from "@/server/llm/providers/types";

const NAGEUR_ID = "30000000-0000-4000-8000-000000000001";

const CONTEXTE: ContexteNageur = {
  coachId: "20000000-0000-4000-8000-000000000001",
  profil: {
    niveau: "intermediaire",
    frequence: 3,
    duree: 60,
    bassin: 25,
    objectifs: ["endurance"],
    materiel: ["pull_buoy", "planche"],
  },
};

const SEANCE_CONFORME = JSON.stringify({
  echauffement: { distance_m: 300, consignes: "Crawl souple." },
  corps: [
    {
      repetitions: 4,
      distance_m: 100,
      type_nage: "crawl",
      recuperation_s: 30,
      consigne: "Allure régulière.",
    },
    { repetitions: 8, distance_m: 50, type_nage: "dos", recuperation_s: 20, consigne: "" },
  ],
  retour_au_calme: { distance_m: 200, consignes: "Très souple." },
  distance_totale_m: 1300,
  duree_estimee_min: 60,
});

const SEANCE_INVALIDE = JSON.stringify({
  echauffement: { distance_m: 300, consignes: "Crawl souple." },
  corps: [
    { repetitions: 4, distance_m: 130, type_nage: "crawl", recuperation_s: 30, consigne: "" },
  ],
  retour_au_calme: { distance_m: 200, consignes: "Très souple." },
  distance_totale_m: 1020,
  duree_estimee_min: 60,
});

type Etape = ReponseFournisseur | GenerationSeanceError;

function fakeDeps(etapes: Etape[], contexte: ContexteNageur = CONTEXTE) {
  const requetes: RequeteFournisseur[] = [];
  const persistees: SeanceAPersister[] = [];
  const journal: EvenementLlm[] = [];
  const file = [...etapes];

  const deps: DepsGeneration = {
    chargerContexte: async () => contexte,
    chargerConfig: async () => ({
      fournisseur: "anthropic",
      modele: "claude-sonnet-4-6",
      apiKey: "sk-test-factice",
    }),
    creerClient: () => ({
      generer: async (requete) => {
        requetes.push(requete);
        const etape = file.shift();
        if (!etape) throw new Error("aucune réponse simulée restante");
        if (etape instanceof GenerationSeanceError) throw etape;
        return etape;
      },
    }),
    persister: async (aPersister) => {
      persistees.push(aPersister);
      return "40000000-0000-4000-8000-00000000abcd";
    },
    journaliser: async (evenement) => {
      journal.push(evenement);
    },
    genererReference: () => "reference-opaque-test",
  };

  return { deps, requetes, persistees, journal };
}

const reponse = (texte: string, entree = 300, sortie = 150): ReponseFournisseur => ({
  texte,
  tokensEntree: entree,
  tokensSortie: sortie,
});

describe("genererSeanceAvecDeps (C2)", () => {
  it("génération réussie : séance persistée en_attente avec fournisseur et tokens (RG-21/RG-22)", async () => {
    const { deps, requetes, persistees, journal } = fakeDeps([reponse(SEANCE_CONFORME)]);

    const resultat = await genererSeanceAvecDeps(deps, NAGEUR_ID);

    expect(resultat).toEqual({
      seanceId: "40000000-0000-4000-8000-00000000abcd",
      fournisseur: "anthropic",
      tokens: 450,
    });
    expect(requetes).toHaveLength(1);
    expect(persistees).toHaveLength(1);
    expect(persistees[0]).toMatchObject({
      nageurId: NAGEUR_ID,
      fournisseur: "anthropic",
      tokens: 450,
    });
    expect(persistees[0].seance.corps).toHaveLength(2);
    expect(journal).toHaveLength(0);
  });

  it("la référence opaque ne part jamais dans les prompts (C2/ADR-008)", async () => {
    const { deps, requetes } = fakeDeps([reponse(SEANCE_CONFORME)]);
    await genererSeanceAvecDeps(deps, NAGEUR_ID);
    expect(requetes[0].systeme).not.toContain("reference-opaque-test");
    expect(requetes[0].utilisateur).not.toContain("reference-opaque-test");
  });

  it("sortie non conforme : une relance automatique corrigée, tokens cumulés (RG-22)", async () => {
    const { deps, requetes, persistees } = fakeDeps([
      reponse(SEANCE_INVALIDE, 300, 150),
      reponse(SEANCE_CONFORME, 320, 160),
    ]);

    const resultat = await genererSeanceAvecDeps(deps, NAGEUR_ID);

    expect(requetes).toHaveLength(2);
    expect(requetes[1].utilisateur).toContain("invalide");
    expect(resultat.tokens).toBe(930);
    expect(persistees).toHaveLength(1);
    expect(persistees[0].tokens).toBe(930);
  });

  it("deux sorties non conformes : échec sans séance créée (C2)", async () => {
    const { deps, requetes, persistees, journal } = fakeDeps([
      reponse("pas du JSON"),
      reponse(SEANCE_INVALIDE),
    ]);

    await expect(genererSeanceAvecDeps(deps, NAGEUR_ID)).rejects.toMatchObject({
      code: "sortie_invalide",
      relancePossible: true,
    });
    expect(requetes).toHaveLength(2); // une seule relance automatique, pas plus
    expect(persistees).toHaveLength(0);
    expect(journal).toEqual([
      {
        type: "llm.generation_echouee",
        nageurId: NAGEUR_ID,
        metadata: { code: "sortie_invalide", fournisseur: "anthropic" },
      },
    ]);
  });

  it("échec fournisseur (quota) : aucune relance automatique, aucune séance, alerte admin (RG-23)", async () => {
    const { deps, requetes, persistees, journal } = fakeDeps([
      new GenerationSeanceError("quota_depasse"),
    ]);

    await expect(genererSeanceAvecDeps(deps, NAGEUR_ID)).rejects.toMatchObject({
      code: "quota_depasse",
      relancePossible: true,
      alerteAdmin: true,
    });
    expect(requetes).toHaveLength(1);
    expect(persistees).toHaveLength(0);
    expect(journal[0]?.metadata.code).toBe("quota_depasse");
  });

  it("délai dépassé : erreur exploitable, relance possible (RG-23/ADR-019)", async () => {
    const { deps, persistees } = fakeDeps([new GenerationSeanceError("delai_depasse")]);

    await expect(genererSeanceAvecDeps(deps, NAGEUR_ID)).rejects.toMatchObject({
      code: "delai_depasse",
      relancePossible: true,
    });
    expect(persistees).toHaveLength(0);
  });

  it("nageur sans coach : pas de génération du tout (RG-14)", async () => {
    const { deps, requetes, journal } = fakeDeps([reponse(SEANCE_CONFORME)], {
      ...CONTEXTE,
      coachId: null,
    });

    await expect(genererSeanceAvecDeps(deps, NAGEUR_ID)).rejects.toMatchObject({
      code: "nageur_sans_coach",
      relancePossible: false,
    });
    expect(requetes).toHaveLength(0);
    expect(journal).toHaveLength(0);
  });

  it("profil sportif manquant : pas de génération (RG-17)", async () => {
    const { deps, requetes } = fakeDeps([reponse(SEANCE_CONFORME)], {
      ...CONTEXTE,
      profil: null,
    });

    await expect(genererSeanceAvecDeps(deps, NAGEUR_ID)).rejects.toMatchObject({
      code: "profil_incomplet",
    });
    expect(requetes).toHaveLength(0);
  });

  it("échec de persistance : erreur exploitable, journalisée, sans séance fantôme", async () => {
    const { deps, journal } = fakeDeps([reponse(SEANCE_CONFORME)]);
    deps.persister = async () => {
      throw new Error("écriture refusée");
    };

    await expect(genererSeanceAvecDeps(deps, NAGEUR_ID)).rejects.toMatchObject({
      code: "persistance_echouee",
      alerteAdmin: true,
    });
    expect(journal[0]?.metadata.code).toBe("persistance_echouee");
  });
});
