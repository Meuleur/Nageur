import Anthropic from "@anthropic-ai/sdk";

import { GenerationSeanceError } from "../errors";
import { SCHEMA_JSON_SEANCE } from "../json-schema";
import {
  MAX_TOKENS_SORTIE,
  TEMPERATURE,
  TIMEOUT_MS,
  type ClientLlm,
  type OptionsClientLlm,
} from "./types";

/**
 * Fournisseur Anthropic (C2) — SDK officiel, sortie structurée via
 * `output_config.format` (json_schema), validation finale côté application.
 * `maxRetries: 0` : aucune relance réseau implicite — la seule relance
 * automatique est celle de la sortie non conforme (C2), pilotée par
 * l'orchestrateur. Les erreurs SDK sont mappées vers GenerationSeanceError
 * sans recopier le message fournisseur (rien d'exploitable à journaliser
 * côté client, aucun risque de fuite).
 */
export function createAnthropicClient(options: OptionsClientLlm): ClientLlm {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: options.timeoutMs ?? TIMEOUT_MS,
    maxRetries: 0,
    fetch: options.fetch,
  });

  return {
    async generer(requete) {
      let reponse: Anthropic.Message;
      try {
        reponse = await client.messages.create({
          model: options.modele,
          max_tokens: MAX_TOKENS_SORTIE,
          temperature: TEMPERATURE,
          system: requete.systeme,
          messages: [{ role: "user", content: requete.utilisateur }],
          output_config: {
            format: { type: "json_schema", schema: SCHEMA_JSON_SEANCE },
          },
        });
      } catch (error) {
        throw mapErreurAnthropic(error);
      }

      const texte = reponse.content
        .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === "text")
        .map((bloc) => bloc.text)
        .join("");

      return {
        texte,
        tokensEntree: reponse.usage.input_tokens,
        tokensSortie: reponse.usage.output_tokens,
      };
    },
  };
}

function mapErreurAnthropic(error: unknown): GenerationSeanceError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new GenerationSeanceError("delai_depasse");
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new GenerationSeanceError("cle_invalide");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new GenerationSeanceError("quota_depasse");
  }
  return new GenerationSeanceError("fournisseur_indisponible");
}
