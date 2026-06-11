import OpenAI from "openai";

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
 * Fournisseur OpenAI (C2) — SDK officiel, sortie structurée via
 * `response_format` (json_schema strict), validation finale côté
 * application. Mêmes principes que le fournisseur Anthropic : pas de
 * relance réseau implicite, erreurs mappées sans recopie du message.
 */
export function createOpenAiClient(options: OptionsClientLlm): ClientLlm {
  const client = new OpenAI({
    apiKey: options.apiKey,
    timeout: options.timeoutMs ?? TIMEOUT_MS,
    maxRetries: 0,
    fetch: options.fetch,
  });

  return {
    async generer(requete) {
      let completion: OpenAI.Chat.Completions.ChatCompletion;
      try {
        completion = await client.chat.completions.create({
          model: options.modele,
          max_completion_tokens: MAX_TOKENS_SORTIE,
          temperature: TEMPERATURE,
          messages: [
            { role: "system", content: requete.systeme },
            { role: "user", content: requete.utilisateur },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "seance_natation",
              strict: true,
              schema: SCHEMA_JSON_SEANCE,
            },
          },
        });
      } catch (error) {
        throw mapErreurOpenAi(error);
      }

      return {
        texte: completion.choices[0]?.message?.content ?? "",
        tokensEntree: completion.usage?.prompt_tokens ?? 0,
        tokensSortie: completion.usage?.completion_tokens ?? 0,
      };
    },
  };
}

function mapErreurOpenAi(error: unknown): GenerationSeanceError {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new GenerationSeanceError("delai_depasse");
  }
  if (
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.PermissionDeniedError
  ) {
    return new GenerationSeanceError("cle_invalide");
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new GenerationSeanceError("quota_depasse");
  }
  return new GenerationSeanceError("fournisseur_indisponible");
}
