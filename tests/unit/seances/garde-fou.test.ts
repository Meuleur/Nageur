import { describe, expect, it } from "vitest";

import { messageGenerationLimitee } from "@/features/seances/garde-fou";
import {
  decideRateLimit,
  RATE_LIMITS,
  type RateLimitDecision,
  type RateLimitState,
} from "@/server/auth/rate-limit-logic";

const NOW = 1_750_000_000_000;
const SECONDE = 1_000;

/** Enchaîne des consommations espacées de `pasMs` et rend les décisions. */
function enchainer(nombre: number, pasMs: number): RateLimitDecision[] {
  const decisions: RateLimitDecision[] = [];
  let state: RateLimitState | null = null;
  for (let i = 0; i < nombre; i++) {
    const decision = decideRateLimit(state, NOW + i * pasMs, RATE_LIMITS.generationByUser);
    decisions.push(decision);
    state = decision.state;
  }
  return decisions;
}

// ADR-027 : garde-fou de sécurité sur la VRAIE politique — pas un quota
// produit, RG-24 (aucun quota ni délai en usage normal) reste respecté.
describe("garde-fou de génération (ADR-027)", () => {
  it("RG-24 : un enchaînement réaliste n'est jamais bloqué (une génération réelle dure 10–60 s)", () => {
    // Rythme déjà improbable : 20 générations d'affilée toutes les 15 s.
    const decisions = enchainer(20, 15 * SECONDE);
    expect(decisions.every((d) => d.allowed)).toBe(true);
  });

  it("bloque une rafale au-delà du seuil dans la même minute", () => {
    const decisions = enchainer(RATE_LIMITS.generationByUser.limit + 1, SECONDE);
    expect(decisions.slice(0, -1).every((d) => d.allowed)).toBe(true);

    const bloquee = decisions.at(-1)!;
    expect(bloquee.allowed).toBe(false);
    // Suspension courte (fin de fenêtre), sans verrou long : transparent
    // dès la minute suivante.
    expect(bloquee.state.lockedUntil).toBeNull();
    expect(bloquee.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(bloquee.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("redevient disponible dès la fenêtre écoulée", () => {
    const rafale = enchainer(RATE_LIMITS.generationByUser.limit + 1, SECONDE);
    const apres = decideRateLimit(
      rafale.at(-1)!.state,
      NOW + RATE_LIMITS.generationByUser.windowMs + SECONDE,
      RATE_LIMITS.generationByUser,
    );
    expect(apres.allowed).toBe(true);
  });

  it("message clair : délai annoncé, accord singulier/pluriel, repli sans délai", () => {
    expect(messageGenerationLimitee(45)).toBe(
      "Vous avez lancé beaucoup de générations en très peu de temps. " +
        "Par mesure de sécurité, patientez environ 45 secondes avant de réessayer.",
    );
    expect(messageGenerationLimitee(1)).toContain("patientez une seconde");
    expect(messageGenerationLimitee()).toContain("patientez quelques instants");
  });
});
