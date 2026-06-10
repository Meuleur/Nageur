import "server-only";

import { cookies } from "next/headers";

import { getAuthSecret } from "@/server/env";

import { createTransitionToken, verifyTransitionToken, type TransitionToken } from "./tokens";

/**
 * Cookies de transition (C1) — httpOnly, signés, à courte vie. Ils ne
 * portent AUCUNE session Supabase : seulement la preuve qu'une étape
 * antérieure du parcours a été franchie côté serveur.
 */
export const PENDING_2FA_COOKIE = "an-2fa-en-attente";
export const RESET_COOKIE = "an-reinitialisation";

/** « OTP en attente » : aligné sur la durée de vie d'un code (ADR-018). */
export const PENDING_2FA_TTL_MS = 10 * 60 * 1000;
/** Les renvois prolongent l'attente, mais jamais au-delà de 30 min après le mot de passe. */
export const PENDING_2FA_MAX_MS = 30 * 60 * 1000;
/** Saisie du nouveau mot de passe après clic sur le lien de reset. */
export const RESET_TTL_MS = 15 * 60 * 1000;

type CookieToSet = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    maxAge: number;
  };
};

function buildCookie(name: string, token: string, expiresAtMs: number): CookieToSet {
  return {
    name,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000)),
    },
  };
}

/** Pose l'état « OTP en attente » ; retourne son échéance (epoch ms). */
export async function setPending2faCookie(sub: string, authAt: number): Promise<number> {
  const exp = Math.min(Date.now() + PENDING_2FA_TTL_MS, authAt + PENDING_2FA_MAX_MS);
  const token = createTransitionToken(getAuthSecret(), { purpose: "pending-2fa", sub, authAt, exp });
  const cookie = buildCookie(PENDING_2FA_COOKIE, token, exp);
  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  return exp;
}

export async function readPending2fa(): Promise<TransitionToken | null> {
  const raw = (await cookies()).get(PENDING_2FA_COOKIE)?.value;
  return verifyTransitionToken(getAuthSecret(), "pending-2fa", raw);
}

export async function clearPending2faCookie(): Promise<void> {
  (await cookies()).delete(PENDING_2FA_COOKIE);
}

/**
 * Cookie de réinitialisation, construit SANS le store `cookies()` : la route
 * /auth/confirm le pose sur sa réponse de redirection (NextResponse).
 */
export function buildResetCookie(sub: string): CookieToSet {
  const now = Date.now();
  const exp = now + RESET_TTL_MS;
  const token = createTransitionToken(getAuthSecret(), { purpose: "password-reset", sub, authAt: now, exp });
  return buildCookie(RESET_COOKIE, token, exp);
}

export async function readResetToken(): Promise<TransitionToken | null> {
  const raw = (await cookies()).get(RESET_COOKIE)?.value;
  return verifyTransitionToken(getAuthSecret(), "password-reset", raw);
}

export async function clearResetCookie(): Promise<void> {
  (await cookies()).delete(RESET_COOKIE);
}
