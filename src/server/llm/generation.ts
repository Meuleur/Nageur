import {
  buildSeanceGenereeSchema,
  type SeanceGeneree,
} from "@/features/seances/schemas";

import { GenerationSeanceError } from "./errors";
import { buildProfilPseudonymise, type ProfilSportifSource } from "./payload";
import { buildPromptRelance, buildPromptUtilisateur, PROMPT_SYSTEME } from "./prompt";
import type { ClientLlm } from "./providers/types";
import type { FournisseurLlm, ProfilPseudonymise, ResultatGeneration } from "./types";

/**
 * Orchestration de la génération (C2) — module pur : toutes les dépendances
 * (accès aux données, configuration, fournisseur, journal) sont injectées,
 * ce qui rend le flux testable avec des fournisseurs simulés (aucun appel
 * réseau en CI, D2).
 */

export type ContexteNageur = {
  /** Coach affecté au moment de la génération (RG-14), null si aucun. */
  coachId: string | null;
  /** Profil sportif complet (RG-17), null si non renseigné. */
  profil: ProfilSportifSource | null;
};

export type ConfigLlm = {
  fournisseur: FournisseurLlm;
  modele: string;
  apiKey: string;
};

export type SeanceAPersister = {
  nageurId: string;
  seance: SeanceGeneree;
  fournisseur: FournisseurLlm;
  tokens: number;
};

export type EvenementLlm = {
  type: "llm.generation_echouee";
  nageurId: string;
  /** Jamais de donnée personnelle ni de contenu : code + fournisseur. */
  metadata: { code: GenerationSeanceError["code"]; fournisseur?: FournisseurLlm };
};

export type DepsGeneration = {
  chargerContexte(nageurId: string): Promise<ContexteNageur>;
  chargerConfig(): Promise<ConfigLlm>;
  creerClient(config: ConfigLlm): ClientLlm;
  persister(seance: SeanceAPersister): Promise<string>;
  /** Journal best effort : un échec d'audit ne casse jamais le parcours. */
  journaliser(evenement: EvenementLlm): Promise<void>;
  /** uuid aléatoire par génération — ID opaque du payload (RG-20). */
  genererReference(): string;
};

/** Une relance automatique au plus sur sortie non conforme (C2/ADR-019). */
const TENTATIVES_MAX = 2;

export async function genererSeanceAvecDeps(
  deps: DepsGeneration,
  nageurId: string,
): Promise<ResultatGeneration> {
  // Préconditions (RG-14, RG-17) — aucune génération, erreur explicite.
  const contexte = await deps.chargerContexte(nageurId);
  if (contexte.coachId === null) {
    throw new GenerationSeanceError("nageur_sans_coach");
  }
  if (contexte.profil === null || contexte.profil.objectifs.length === 0) {
    throw new GenerationSeanceError("profil_incomplet");
  }

  const config = await deps.chargerConfig();
  const client = deps.creerClient(config);
  const profil = buildProfilPseudonymise(contexte.profil, deps.genererReference());

  const echec = async (code: GenerationSeanceError["code"]): Promise<GenerationSeanceError> => {
    await deps.journaliser({
      type: "llm.generation_echouee",
      nageurId,
      metadata: { code, fournisseur: config.fournisseur },
    });
    return new GenerationSeanceError(code);
  };

  let tokens = 0;
  let problemes: string[] = [];

  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    const utilisateur =
      tentative === 1
        ? buildPromptUtilisateur(profil)
        : buildPromptRelance(profil, problemes);

    let reponse;
    try {
      reponse = await client.generer({ systeme: PROMPT_SYSTEME, utilisateur });
    } catch (error) {
      // Échec fournisseur (RG-23) : aucune séance, pas de relance
      // automatique — le nageur peut relancer lui-même (RG-24).
      const code =
        error instanceof GenerationSeanceError ? error.code : "fournisseur_indisponible";
      throw await echec(code);
    }

    tokens += reponse.tokensEntree + reponse.tokensSortie;

    const validation = validerSortie(reponse.texte, profil);
    if (!validation.ok) {
      problemes = validation.problemes;
      continue;
    }

    let seanceId: string;
    try {
      seanceId = await deps.persister({
        nageurId,
        seance: validation.seance,
        fournisseur: config.fournisseur,
        tokens,
      });
    } catch (error) {
      const code =
        error instanceof GenerationSeanceError ? error.code : "persistance_echouee";
      throw await echec(code);
    }

    return { seanceId, fournisseur: config.fournisseur, tokens };
  }

  // Sortie non conforme malgré la relance unique : échec sans séance (C2).
  throw await echec("sortie_invalide");
}

type Validation =
  | { ok: true; seance: SeanceGeneree }
  | { ok: false; problemes: string[] };

function validerSortie(texte: string, profil: ProfilPseudonymise): Validation {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, problemes: ["La réponse n'est pas un JSON valide."] };
  }

  const schema = buildSeanceGenereeSchema({
    dureeCibleMin: profil.dureeCibleMin,
    materielDisponible: profil.materiel,
  });
  const resultat = schema.safeParse(brut);
  if (!resultat.success) {
    return {
      ok: false,
      problemes: resultat.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "racine"} : ${issue.message}`),
    };
  }

  return { ok: true, seance: resultat.data };
}
