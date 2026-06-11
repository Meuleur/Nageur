/**
 * Interface des fournisseurs LLM (C2/ADR-007) — implémentations
 * interchangeables derrière `ClientLlm`, simulables dans les tests
 * (aucun appel réseau en CI).
 */

export type RequeteFournisseur = {
  systeme: string;
  utilisateur: string;
};

export type ReponseFournisseur = {
  /** Texte brut renvoyé (JSON attendu, validé par l'application). */
  texte: string;
  /** Consommation renvoyée par le fournisseur (RG-22). */
  tokensEntree: number;
  tokensSortie: number;
};

export interface ClientLlm {
  generer(requete: RequeteFournisseur): Promise<ReponseFournisseur>;
}

export type OptionsClientLlm = {
  apiKey: string;
  modele: string;
  /** Délai maximal de l'appel (ADR-019 : 30–60 s). */
  timeoutMs?: number;
  /** Transport injectable pour les tests (aucun réseau en CI). */
  fetch?: typeof globalThis.fetch;
};

/** Paramètres de génération validés (ADR-019). */
export const TIMEOUT_MS = 45_000;
export const TEMPERATURE = 0.7;
export const MAX_TOKENS_SORTIE = 2048;
