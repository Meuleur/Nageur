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

/**
 * Politiques de limitation (C1) : seules les valeurs « renvoi OTP 60 s » et
 * « verrouillage ~10 échecs de connexion » sont imposées par l'ADR-018 ;
 * les autres sont des garde-fous applicatifs dimensionnés large. Déclarées
 * ici (module pur) pour que les tests unitaires portent sur les politiques
 * réelles ; la consommation vit dans ./rate-limit.ts.
 */
export const RATE_LIMITS = {
  /** Échecs de connexion par compte : ~10 → verrou temporaire (ADR-018). */
  loginFailuresByEmail: { limit: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  /** Garde-fou grossier par IP — la mesure fine est le verrou par compte. */
  loginByIp: { limit: 100, windowMs: 15 * 60_000 },
  signupByIp: { limit: 20, windowMs: 60 * 60_000 },
  /** Renvoi d'un code OTP : au plus un envoi par minute (ADR-018). */
  otpSendByUser: { limit: 1, windowMs: 60_000 },
  otpSendHourlyByUser: { limit: 10, windowMs: 60 * 60_000 },
  otpVerifyByIp: { limit: 60, windowMs: 15 * 60_000 },
  resetByEmail: { limit: 3, windowMs: 60 * 60_000 },
  resetByIp: { limit: 10, windowMs: 60 * 60_000 },
  verificationResendByIp: { limit: 10, windowMs: 60 * 60_000 },
  /**
   * Garde-fou anti-abus de la génération de séance (ADR-027) : protection de
   * coût/DoS, PAS un quota produit — une génération réelle dure 10 à 60 s
   * (ADR-019), le seuil reste donc invisible en usage normal (RG-24).
   */
  generationByUser: { limit: 5, windowMs: 60_000 },
} satisfies Record<string, RateLimitPolicy>;

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
