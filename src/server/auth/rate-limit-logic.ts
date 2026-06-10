/**
 * Limitation de débit applicative (C1) — logique pure de fenêtre fixe avec
 * verrouillage optionnel, testable unitairement. La persistance
 * (public.auth_rate_limits) vit dans ./rate-limit.ts.
 */
export type RateLimitPolicy = {
  /** Nombre d'actions autorisées par fenêtre. */
  limit: number;
  windowMs: number;
  /** Si présent : dépasser la limite pose un verrou de cette durée. */
  lockMs?: number;
};

export type RateLimitState = {
  count: number;
  /** Epoch ms — début de la fenêtre courante. */
  windowStart: number;
  /** Epoch ms — fin de verrouillage, le cas échéant. */
  lockedUntil: number | null;
};

export type RateLimitDecision = {
  allowed: boolean;
  state: RateLimitState;
  retryAfterSeconds?: number;
};

function secondsUntil(timestamp: number, now: number): number {
  return Math.max(1, Math.ceil((timestamp - now) / 1000));
}

/** Consomme une action : décide et produit l'état à persister. */
export function decideRateLimit(
  state: RateLimitState | null,
  now: number,
  policy: RateLimitPolicy,
): RateLimitDecision {
  if (state?.lockedUntil && state.lockedUntil > now) {
    return { allowed: false, state, retryAfterSeconds: secondsUntil(state.lockedUntil, now) };
  }

  // Fenêtre expirée (ou verrou levé) : on repart de zéro.
  if (!state || state.windowStart + policy.windowMs <= now || state.lockedUntil) {
    return { allowed: true, state: { count: 1, windowStart: now, lockedUntil: null } };
  }

  const count = state.count + 1;
  if (count <= policy.limit) {
    return { allowed: true, state: { ...state, count } };
  }

  const lockedUntil = policy.lockMs ? now + policy.lockMs : null;
  const retryAt = lockedUntil ?? state.windowStart + policy.windowMs;
  return {
    allowed: false,
    state: { ...state, count, lockedUntil },
    retryAfterSeconds: secondsUntil(retryAt, now),
  };
}
