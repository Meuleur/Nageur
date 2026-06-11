import type { FournisseurLlm } from "../types";
import { createAnthropicClient } from "./anthropic";
import { createOpenAiClient } from "./openai";
import type { ClientLlm, OptionsClientLlm } from "./types";

/**
 * Sélection de l'implémentation derrière l'interface unique (C2/ADR-007).
 * Le fournisseur actif et son modèle viennent de `llm_providers` (RG-38).
 */
export function createClientLlm(fournisseur: FournisseurLlm, options: OptionsClientLlm): ClientLlm {
  switch (fournisseur) {
    case "anthropic":
      return createAnthropicClient(options);
    case "openai":
      return createOpenAiClient(options);
  }
}
