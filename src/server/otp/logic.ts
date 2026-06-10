import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Logique pure du second facteur e-mail (C1) — paramètres validés ADR-018.
 * Aucune dépendance serveur : testable unitairement. La persistance et les
 * réservations atomiques vivent dans ./index.ts.
 */
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Code numérique à 6 chiffres, tirage cryptographique (zéros conservés). */
export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

/**
 * Hachage à clé (HMAC-SHA256, secret serveur) : contrairement à un hachage
 * nu, un dump de la table otp_codes ne permet pas de retrouver un code à
 * 6 chiffres par force brute hors ligne (10^6 candidats).
 */
export function hashOtpCode(secret: string, userId: string, code: string): string {
  return createHmac("sha256", `${secret}:otp`).update(`${userId}:${code}`).digest("hex");
}

/** Comparaison en temps constant de deux empreintes hexadécimales. */
export function otpHashesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export type OtpRecord = {
  code_hash: string;
  expires_at: string;
  /** Nombre de tentatives, TENTATIVE COURANTE INCLUSE (déjà réservée). */
  attempts: number;
  used: boolean;
};

export type OtpDecision =
  | { status: "ok" }
  /** Aucun code actif, code expiré ou déjà utilisé → redemander un code. */
  | { status: "expired" }
  /** Plafond de tentatives consommé (RG-07) → redemander un code. */
  | { status: "locked" }
  | { status: "mismatch"; remainingAttempts: number };

/**
 * Évalue UNE tentative déjà comptée (record.attempts inclut la tentative
 * courante, réservée atomiquement par le service).
 */
export function decideOtpAttempt(
  record: OtpRecord,
  candidateHash: string,
  now: number,
): OtpDecision {
  if (record.used) {
    return { status: "expired" };
  }
  if (new Date(record.expires_at).getTime() <= now) {
    return { status: "expired" };
  }
  if (record.attempts > OTP_MAX_ATTEMPTS) {
    return { status: "locked" };
  }
  if (!otpHashesMatch(record.code_hash, candidateHash)) {
    const remainingAttempts = Math.max(0, OTP_MAX_ATTEMPTS - record.attempts);
    return remainingAttempts === 0
      ? { status: "locked" }
      : { status: "mismatch", remainingAttempts };
  }
  return { status: "ok" };
}
