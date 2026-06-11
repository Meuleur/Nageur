// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildProfilPseudonymise, type ProfilSportifSource } from "@/server/llm/payload";
import { buildPromptUtilisateur, PROMPT_SYSTEME } from "@/server/llm/prompt";
import { createAnthropicClient } from "@/server/llm/providers/anthropic";
import { createOpenAiClient } from "@/server/llm/providers/openai";
import type { ClientLlm, OptionsClientLlm } from "@/server/llm/providers/types";

/**
 * Fournisseurs simulés au niveau du transport HTTP (option fetch des SDK
 * officiels) : aucun appel réseau, et surtout inspection du payload
 * RÉELLEMENT émis vers le fournisseur (revue RGPD du chantier — ADR-008).
 */

type AppelHttp = { url: string; corps: string };

function fetchSimule(status: number, corps: unknown) {
  const appels: AppelHttp[] = [];
  const fetchImpl = (async (entree: RequestInfo | URL, init?: RequestInit) => {
    appels.push({ url: String(entree), corps: String(init?.body ?? "") });
    return new Response(JSON.stringify(corps), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, appels };
}

/** fetch qui ne répond jamais mais honore l'annulation du SDK (timeout). */
const fetchSuspendu = ((_entree: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    );
  })) as typeof fetch;

const REPONSE_ANTHROPIC = {
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-4-6",
  content: [{ type: "text", text: '{"seance":"ok"}' }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 321, output_tokens: 123 },
};

const REPONSE_OPENAI = {
  id: "chatcmpl_test",
  object: "chat.completion",
  created: 1,
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: '{"seance":"ok"}', refusal: null },
      finish_reason: "stop",
      logprobs: null,
    },
  ],
  usage: { prompt_tokens: 222, completion_tokens: 111, total_tokens: 333 },
};

const ERREUR_ANTHROPIC = (type: string) => ({
  type: "error",
  error: { type, message: "erreur simulée" },
});

const ERREUR_OPENAI = (code: string) => ({
  error: { message: "erreur simulée", type: "invalid_request_error", param: null, code },
});

const SOURCE_AVEC_IDENTITE = {
  niveau: "intermediaire",
  frequence: 3,
  duree: 60,
  bassin: 25,
  objectifs: ["endurance"],
  materiel: ["pull_buoy"],
  prenom: "Léa",
  nom: "Petit",
  email: "lea.nageur@nageur.test",
  disponibilites: [{ jour: 1, moment: "matin" }],
} as ProfilSportifSource;

const REFERENCE = "11111111-2222-4333-8444-555555555555";

const REQUETE = (() => {
  const profil = buildProfilPseudonymise(SOURCE_AVEC_IDENTITE, REFERENCE);
  return { systeme: PROMPT_SYSTEME, utilisateur: buildPromptUtilisateur(profil) };
})();

type CasFournisseur = {
  nom: string;
  creer: (options: OptionsClientLlm) => ClientLlm;
  modele: string;
  reponseValide: unknown;
  erreur401: unknown;
  erreur429: unknown;
  erreur503: unknown;
  tokens: { entree: number; sortie: number };
};

const CAS: CasFournisseur[] = [
  {
    nom: "anthropic",
    creer: createAnthropicClient,
    modele: "claude-sonnet-4-6",
    reponseValide: REPONSE_ANTHROPIC,
    erreur401: ERREUR_ANTHROPIC("authentication_error"),
    erreur429: ERREUR_ANTHROPIC("rate_limit_error"),
    erreur503: ERREUR_ANTHROPIC("api_error"),
    tokens: { entree: 321, sortie: 123 },
  },
  {
    nom: "openai",
    creer: createOpenAiClient,
    modele: "gpt-4o",
    reponseValide: REPONSE_OPENAI,
    erreur401: ERREUR_OPENAI("invalid_api_key"),
    erreur429: ERREUR_OPENAI("rate_limit_exceeded"),
    erreur503: ERREUR_OPENAI("server_error"),
    tokens: { entree: 222, sortie: 111 },
  },
];

describe.each(CAS)("fournisseur $nom (SDK officiel, transport simulé)", (cas) => {
  const options = (fetchImpl: typeof fetch, timeoutMs?: number): OptionsClientLlm => ({
    apiKey: "sk-cle-de-test",
    modele: cas.modele,
    fetch: fetchImpl,
    timeoutMs,
  });

  it("le payload réellement envoyé ne contient ni identité, ni disponibilités, ni référence opaque (ADR-008)", async () => {
    const { fetchImpl, appels } = fetchSimule(200, cas.reponseValide);
    await cas.creer(options(fetchImpl)).generer(REQUETE);

    expect(appels).toHaveLength(1);
    const corps = appels[0].corps;
    expect(corps.length).toBeGreaterThan(0);
    expect(corps).not.toContain("Léa");
    expect(corps).not.toContain("Petit");
    expect(corps).not.toContain("lea.nageur");
    expect(corps).not.toContain("nageur.test");
    expect(corps.toLowerCase()).not.toContain("disponibilit");
    expect(corps).not.toContain("matin");
    expect(corps).not.toContain(REFERENCE);
    // Les attributs sportifs pseudonymisés, eux, partent bien.
    expect(corps).toContain("Intermédiaire");
    expect(corps).toContain("Pull-buoy");
  });

  it("texte et consommation de tokens sont lus depuis la réponse (RG-22)", async () => {
    const { fetchImpl } = fetchSimule(200, cas.reponseValide);
    const reponse = await cas.creer(options(fetchImpl)).generer(REQUETE);

    expect(reponse.texte).toBe('{"seance":"ok"}');
    expect(reponse.tokensEntree).toBe(cas.tokens.entree);
    expect(reponse.tokensSortie).toBe(cas.tokens.sortie);
  });

  it("clé invalide (401) → cle_invalide, alerte admin (RG-23)", async () => {
    const { fetchImpl } = fetchSimule(401, cas.erreur401);
    await expect(cas.creer(options(fetchImpl)).generer(REQUETE)).rejects.toMatchObject({
      code: "cle_invalide",
      alerteAdmin: true,
    });
  });

  it("quota dépassé (429) → quota_depasse, alerte admin (RG-23)", async () => {
    const { fetchImpl } = fetchSimule(429, cas.erreur429);
    await expect(cas.creer(options(fetchImpl)).generer(REQUETE)).rejects.toMatchObject({
      code: "quota_depasse",
      alerteAdmin: true,
    });
  });

  it("indisponibilité (503) → fournisseur_indisponible (RG-23)", async () => {
    const { fetchImpl } = fetchSimule(503, cas.erreur503);
    await expect(cas.creer(options(fetchImpl)).generer(REQUETE)).rejects.toMatchObject({
      code: "fournisseur_indisponible",
      relancePossible: true,
    });
  });

  it("délai dépassé → delai_depasse (ADR-019)", async () => {
    await expect(cas.creer(options(fetchSuspendu, 100)).generer(REQUETE)).rejects.toMatchObject({
      code: "delai_depasse",
    });
  });
});
