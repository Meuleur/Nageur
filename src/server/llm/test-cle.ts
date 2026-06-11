import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { FournisseurLlm } from "./types";

/**
 * Test de validité d'une clé API (E-31, C4) — appel MINIMAL côté serveur :
 * GET /models des deux fournisseurs. Authentifié mais sans aucune
 * génération ni consommation de tokens ; la clé ne quitte jamais le serveur
 * et n'apparaît dans aucun journal (ADR-007). Module pur : le transport
 * fetch est injectable (aucun appel réseau dans les tests, D2).
 */

export type ResultatTestCle =
  | { ok: true }
  | { ok: false; code: "cle_invalide" | "fournisseur_injoignable" };

export type OptionsTestCle = {
  apiKey: string;
  /** Test interactif : délai court (un écran attend la réponse). */
  timeoutMs?: number;
  /** Transport injectable pour les tests (aucun réseau en CI). */
  fetch?: typeof globalThis.fetch;
};

const TIMEOUT_TEST_MS = 10_000;

export async function testerCleFournisseur(
  fournisseur: FournisseurLlm,
  options: OptionsTestCle,
): Promise<ResultatTestCle> {
  const commun = {
    apiKey: options.apiKey,
    timeout: options.timeoutMs ?? TIMEOUT_TEST_MS,
    maxRetries: 0,
    fetch: options.fetch,
  };

  try {
    if (fournisseur === "anthropic") {
      await new Anthropic(commun).models.list();
    } else {
      await new OpenAI(commun).models.list();
    }
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError ||
      error instanceof OpenAI.AuthenticationError ||
      error instanceof OpenAI.PermissionDeniedError
    ) {
      return { ok: false, code: "cle_invalide" };
    }
    // Timeout, 5xx, réseau : la clé n'est ni confirmée ni infirmée.
    return { ok: false, code: "fournisseur_injoignable" };
  }
}
