import { describe, expect, it } from "vitest";

import {
  decideRateLimit,
  type RateLimitPolicy,
  type RateLimitState,
} from "@/server/auth/rate-limit-logic";

const NOW = 1_750_000_000_000;
const MINUTE = 60_000;

// C1 : limitation de débit + verrouillage temporaire (~10 échecs, ADR-018).
describe("decideRateLimit", () => {
  const policy: RateLimitPolicy = { limit: 3, windowMs: 10 * MINUTE };

  it("démarre une fenêtre au premier passage", () => {
    expect(decideRateLimit(null, NOW, policy)).toEqual({
      allowed: true,
      state: { count: 1, windowStart: NOW, lockedUntil: null },
    });
  });

  it("compte dans la fenêtre et autorise jusqu'à la limite", () => {
    let state: RateLimitState = { count: 1, windowStart: NOW, lockedUntil: null };
    let decision = decideRateLimit(state, NOW + MINUTE, policy);
    expect(decision).toMatchObject({ allowed: true, state: { count: 2 } });
    decision = decideRateLimit(decision.state, NOW + 2 * MINUTE, policy);
    expect(decision).toMatchObject({ allowed: true, state: { count: 3 } });
  });

  it("refuse au-delà de la limite, avec délai de réessai en fin de fenêtre", () => {
    const state: RateLimitState = { count: 3, windowStart: NOW, lockedUntil: null };
    const decision = decideRateLimit(state, NOW + 4 * MINUTE, policy);
    expect(decision.allowed).toBe(false);
    expect(decision.state.count).toBe(4);
    expect(decision.retryAfterSeconds).toBe(6 * 60); // fin de fenêtre dans 6 min
  });

  it("repart de zéro quand la fenêtre est écoulée", () => {
    const state: RateLimitState = { count: 3, windowStart: NOW, lockedUntil: null };
    const decision = decideRateLimit(state, NOW + 10 * MINUTE, policy);
    expect(decision).toEqual({
      allowed: true,
      state: { count: 1, windowStart: NOW + 10 * MINUTE, lockedUntil: null },
    });
  });

  describe("avec verrouillage (lockMs)", () => {
    const lockPolicy: RateLimitPolicy = { limit: 10, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE };

    it("pose le verrou au dépassement (10 échecs → ~15 min)", () => {
      const state: RateLimitState = { count: 10, windowStart: NOW, lockedUntil: null };
      const decision = decideRateLimit(state, NOW + MINUTE, lockPolicy);
      expect(decision.allowed).toBe(false);
      expect(decision.state.lockedUntil).toBe(NOW + MINUTE + 15 * MINUTE);
      expect(decision.retryAfterSeconds).toBe(15 * 60);
    });

    it("refuse tant que le verrou court, avec le délai restant", () => {
      const state: RateLimitState = {
        count: 11,
        windowStart: NOW,
        lockedUntil: NOW + 15 * MINUTE,
      };
      const decision = decideRateLimit(state, NOW + 5 * MINUTE, lockPolicy);
      expect(decision.allowed).toBe(false);
      expect(decision.state).toEqual(state); // l'état ne bouge pas pendant le verrou
      expect(decision.retryAfterSeconds).toBe(10 * 60);
    });

    it("repart de zéro à l'expiration du verrou", () => {
      const state: RateLimitState = {
        count: 11,
        windowStart: NOW,
        lockedUntil: NOW + 15 * MINUTE,
      };
      const decision = decideRateLimit(state, NOW + 15 * MINUTE, lockPolicy);
      expect(decision).toEqual({
        allowed: true,
        state: { count: 1, windowStart: NOW + 15 * MINUTE, lockedUntil: null },
      });
    });
  });

  it("renvoie un délai d'au moins 1 seconde", () => {
    const state: RateLimitState = { count: 3, windowStart: NOW, lockedUntil: null };
    const decision = decideRateLimit(state, NOW + 10 * MINUTE - 10, policy);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
