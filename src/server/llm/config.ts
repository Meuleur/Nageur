import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

import { GenerationSeanceError } from "./errors";
import type { ConfigLlm } from "./generation";

/**
 * Lecture de la configuration LLM active (RG-38) : fournisseur, modèle et
 * clé API déchiffrée par Vault côté Postgres (get_active_llm_config,
 * SECURITY DEFINER, EXECUTE service_role uniquement — ADR-007). La clé ne
 * quitte jamais le serveur et n'est jamais journalisée.
 */
export async function chargerConfigLlmActive(): Promise<ConfigLlm> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_active_llm_config");

  if (error) {
    console.error("llm: lecture de la configuration active impossible");
    throw new GenerationSeanceError("configuration_manquante");
  }

  const ligne = (Array.isArray(data) ? data[0] : data) as
    | { fournisseur: "openai" | "anthropic"; modele: string | null; api_key: string | null }
    | undefined;

  if (!ligne || !ligne.modele || !ligne.api_key) {
    console.error("llm: aucun fournisseur actif configuré (modèle ou clé manquants)");
    throw new GenerationSeanceError("configuration_manquante");
  }

  return { fournisseur: ligne.fournisseur, modele: ligne.modele, apiKey: ligne.api_key };
}
