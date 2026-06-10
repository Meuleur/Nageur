import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jetons de transition signés (C1 — gating du second facteur) :
 *   - "pending-2fa" : mot de passe vérifié, OTP en attente. C'est le SEUL
 *     état détenu par le navigateur entre les deux facteurs — il ne porte
 *     aucune session Supabase et n'ouvre aucun accès aux données.
 *   - "password-reset" : lien de réinitialisation consommé côté serveur,
 *     nouveau mot de passe en attente de saisie.
 * Format : base64url(payload JSON) + "." + base64url(HMAC-SHA256).
 * Module pur (le secret est passé en paramètre) → testable unitairement.
 */
export type TokenPurpose = "pending-2fa" | "password-reset";

export type TransitionToken = {
  purpose: TokenPurpose;
  /** auth.users.id */
  sub: string;
  /** Epoch ms — instant de validation du premier facteur. */
  authAt: number;
  /** Epoch ms — expiration du jeton. */
  exp: number;
};

function signature(secret: string, body: string): Buffer {
  // Domaine dédié : un HMAC produit pour un autre usage (codes OTP,
  // rate limiting) ne peut pas être rejoué comme jeton de transition.
  return createHmac("sha256", `${secret}:transition-token`).update(body).digest();
}

export function createTransitionToken(secret: string, payload: TransitionToken): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(secret, body).toString("base64url")}`;
}

export function verifyTransitionToken(
  secret: string,
  purpose: TokenPurpose,
  raw: string | undefined,
  now: number = Date.now(),
): TransitionToken | null {
  if (!raw) {
    return null;
  }
  const [body, sig, ...rest] = raw.split(".");
  if (!body || !sig || rest.length > 0) {
    return null;
  }
  const provided = Buffer.from(sig, "base64url");
  const expected = signature(secret, body);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let payload: TransitionToken;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TransitionToken;
  } catch {
    return null;
  }
  if (payload.purpose !== purpose) {
    return null;
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return null;
  }
  if (typeof payload.authAt !== "number") {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    return null;
  }
  return payload;
}
