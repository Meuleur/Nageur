// @vitest-environment node
import { describe, expect, it } from "vitest";

import { accepteTemperature } from "@/server/llm/providers/echantillonnage";
import { createAnthropicClient } from "@/server/llm/providers/anthropic";

/**
 * ADR-025 — les modèles Anthropic Opus 4.7+ (et Fable) rejettent les
 * paramètres d'échantillonnage : l'abstraction doit OMETTRE la température
 * selon le modèle choisi par le Super Admin (E-31). Vérifié au niveau du
 * prédicat ET du payload HTTP réellement émis (option fetch du SDK).
 */

describe("accepteTemperature (ADR-025)", () => {
  it.each([
    ["claude-sonnet-4-6", true],
    ["claude-haiku-4-5", true],
    ["claude-haiku-4-5-20251001", true],
    ["claude-opus-4-6", true],
    ["claude-opus-4-5-20251101", true],
    // Identifiant complet daté d'Opus 4.0 : le segment date n'est PAS une
    // version mineure — la température reste envoyée.
    ["claude-opus-4-20250514", true],
    ["claude-opus-4-7", false],
    ["claude-opus-4-8", false],
    ["claude-opus-4-7-20260301", false],
    ["claude-opus-5-0", false],
    ["claude-fable-5", false],
    // Hors famille Anthropic : non concerné par ADR-025.
    ["gpt-4o", true],
  ])("%s → accepte la température : %s", (modele, attendu) => {
    expect(accepteTemperature(modele)).toBe(attendu);
  });
});

const REPONSE_ANTHROPIC = {
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-opus-4-8",
  content: [{ type: "text", text: '{"seance":"ok"}' }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
};

function fetchSimule() {
  const corps: string[] = [];
  const fetchImpl = (async (_entree: RequestInfo | URL, init?: RequestInit) => {
    corps.push(String(init?.body ?? ""));
    return new Response(JSON.stringify(REPONSE_ANTHROPIC), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, corps };
}

const REQUETE = { systeme: "système", utilisateur: "utilisateur" };

describe("fournisseur Anthropic — omission de la température (ADR-025)", () => {
  it("Opus 4.8 : le payload émis ne contient AUCUN paramètre d'échantillonnage", async () => {
    const { fetchImpl, corps } = fetchSimule();
    const client = createAnthropicClient({
      apiKey: "sk-test",
      modele: "claude-opus-4-8",
      fetch: fetchImpl,
    });

    await client.generer(REQUETE);

    const payload = JSON.parse(corps[0]) as Record<string, unknown>;
    expect(payload.model).toBe("claude-opus-4-8");
    expect(payload).not.toHaveProperty("temperature");
    expect(payload).not.toHaveProperty("top_p");
    expect(payload).not.toHaveProperty("top_k");
  });

  it("Sonnet 4.6 : la température validée (ADR-019) reste envoyée", async () => {
    const { fetchImpl, corps } = fetchSimule();
    const client = createAnthropicClient({
      apiKey: "sk-test",
      modele: "claude-sonnet-4-6",
      fetch: fetchImpl,
    });

    await client.generer(REQUETE);

    const payload = JSON.parse(corps[0]) as Record<string, unknown>;
    expect(payload.temperature).toBe(0.7);
  });
});
