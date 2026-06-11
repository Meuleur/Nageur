/**
 * ADR-025 — caveat des modèles Anthropic récents : Opus 4.7+ et la famille
 * Fable REJETTENT les paramètres d'échantillonnage (temperature, top_p,
 * top_k → erreur 400 invalid_request_error). Le Super Admin choisissant
 * librement le modèle (E-31, RG-38), l'abstraction omet la température
 * selon le modèle. Les autres modèles (Sonnet, Haiku, Opus ≤ 4.6, OpenAI)
 * continuent de recevoir la température validée par ADR-019.
 *
 * Module pur, partagé par le fournisseur Anthropic et les tests.
 */
export function accepteTemperature(modele: string): boolean {
  // Famille Fable : échantillonnage rejeté dès la première version.
  if (modele.startsWith("claude-fable")) {
    return false;
  }
  // Opus 4.7, 4.8, 4.9 — avec ou sans suffixe daté (claude-opus-4-7-2026…).
  if (/^claude-opus-4-[7-9](-|$)/.test(modele)) {
    return false;
  }
  // Toute génération d'Opus postérieure à la série 4 (Opus 5+).
  // NB : un segment daté (claude-opus-4-20250514 = Opus 4.0) ne matche pas.
  if (/^claude-opus-(?:[5-9]|\d{2,})(-|$)/.test(modele)) {
    return false;
  }
  return true;
}
