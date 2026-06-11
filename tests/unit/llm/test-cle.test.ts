// @vitest-environment node
import { describe, expect, it } from "vitest";

import { testerCleFournisseur } from "@/server/llm/test-cle";

/**
 * Test de clé E-31 (C4) — appel minimal GET /models, simulé au niveau du
 * transport HTTP (option fetch des SDK) : aucun réseau en CI, et vérification
 * que l'appel n'est PAS une génération (aucun corps, méthode GET).
 */

type AppelHttp = { url: string; methode: string; corps: string };

function fetchSimule(status: number, corps: unknown) {
  const appels: AppelHttp[] = [];
  const fetchImpl = (async (entree: RequestInfo | URL, init?: RequestInit) => {
    appels.push({
      url: String(entree),
      methode: init?.method ?? "GET",
      corps: String(init?.body ?? ""),
    });
    return new Response(JSON.stringify(corps), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, appels };
}

const MODELES_ANTHROPIC = { data: [], has_more: false, first_id: null, last_id: null };
const MODELES_OPENAI = { object: "list", data: [] };

const ERREUR_ANTHROPIC = (type: string) => ({
  type: "error",
  error: { type, message: "erreur simulée" },
});

const ERREUR_OPENAI = {
  error: { message: "erreur simulée", type: "invalid_request_error", param: null, code: null },
};

describe("testerCleFournisseur (E-31, C4)", () => {
  it("anthropic : clé valide → ok, via un GET /models sans corps (zéro token)", async () => {
    const { fetchImpl, appels } = fetchSimule(200, MODELES_ANTHROPIC);

    const resultat = await testerCleFournisseur("anthropic", {
      apiKey: "sk-ant-valide",
      fetch: fetchImpl,
    });

    expect(resultat).toEqual({ ok: true });
    expect(appels[0].url).toContain("/models");
    expect(appels[0].methode.toUpperCase()).toBe("GET");
    expect(appels[0].corps).toBe("");
  });

  it("openai : clé valide → ok, via un GET /models", async () => {
    const { fetchImpl, appels } = fetchSimule(200, MODELES_OPENAI);

    const resultat = await testerCleFournisseur("openai", {
      apiKey: "sk-valide",
      fetch: fetchImpl,
    });

    expect(resultat).toEqual({ ok: true });
    expect(appels[0].url).toContain("/models");
  });

  it("anthropic : 401 → cle_invalide", async () => {
    const { fetchImpl } = fetchSimule(401, ERREUR_ANTHROPIC("authentication_error"));

    const resultat = await testerCleFournisseur("anthropic", {
      apiKey: "sk-ant-revoquee",
      fetch: fetchImpl,
    });

    expect(resultat).toEqual({ ok: false, code: "cle_invalide" });
  });

  it("openai : 401 → cle_invalide", async () => {
    const { fetchImpl } = fetchSimule(401, ERREUR_OPENAI);

    const resultat = await testerCleFournisseur("openai", {
      apiKey: "sk-revoquee",
      fetch: fetchImpl,
    });

    expect(resultat).toEqual({ ok: false, code: "cle_invalide" });
  });

  it("anthropic : 503 → fournisseur_injoignable (clé ni confirmée ni infirmée)", async () => {
    const { fetchImpl } = fetchSimule(503, ERREUR_ANTHROPIC("api_error"));

    const resultat = await testerCleFournisseur("anthropic", {
      apiKey: "sk-ant-valide",
      fetch: fetchImpl,
    });

    expect(resultat).toEqual({ ok: false, code: "fournisseur_injoignable" });
  });

  it("délai dépassé → fournisseur_injoignable", async () => {
    // fetch qui ne répond jamais mais honore l'annulation du SDK.
    const fetchSuspendu = ((_entree: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      })) as typeof fetch;

    const resultat = await testerCleFournisseur("anthropic", {
      apiKey: "sk-ant-valide",
      timeoutMs: 50,
      fetch: fetchSuspendu,
    });

    expect(resultat).toEqual({ ok: false, code: "fournisseur_injoignable" });
  }, 10_000);
});
