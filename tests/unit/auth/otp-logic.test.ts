import { describe, expect, it } from "vitest";

import {
  decideOtpAttempt,
  generateOtpCode,
  hashOtpCode,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  otpHashesMatch,
  type OtpRecord,
} from "@/server/otp/logic";

const SECRET = "secret-de-test-suffisamment-long-0123456789";
const USER_ID = "30000000-0000-4000-8000-000000000001";
const NOW = 1_750_000_000_000;

function record(overrides: Partial<OtpRecord> = {}): OtpRecord {
  return {
    code_hash: hashOtpCode(SECRET, USER_ID, "123456"),
    expires_at: new Date(NOW + OTP_TTL_MS).toISOString(),
    attempts: 1, // tentative courante incluse (réservée par le service)
    used: false,
    ...overrides,
  };
}

describe("generateOtpCode", () => {
  it("produit toujours 6 chiffres (zéros de tête conservés)", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtpCode", () => {
  it("est déterministe et dépend du secret, de l'utilisateur et du code", () => {
    const base = hashOtpCode(SECRET, USER_ID, "123456");
    expect(hashOtpCode(SECRET, USER_ID, "123456")).toBe(base);
    expect(hashOtpCode(SECRET, USER_ID, "123457")).not.toBe(base);
    expect(hashOtpCode(SECRET, "autre-utilisateur", "123456")).not.toBe(base);
    expect(hashOtpCode("autre-secret-tres-long-aussi-0123456789", USER_ID, "123456")).not.toBe(
      base,
    );
  });

  it("ne stocke jamais le code en clair", () => {
    expect(hashOtpCode(SECRET, USER_ID, "123456")).not.toContain("123456");
  });
});

describe("otpHashesMatch", () => {
  it("compare correctement (y compris longueurs différentes)", () => {
    const a = hashOtpCode(SECRET, USER_ID, "123456");
    expect(otpHashesMatch(a, a)).toBe(true);
    expect(otpHashesMatch(a, hashOtpCode(SECRET, USER_ID, "654321"))).toBe(false);
    expect(otpHashesMatch(a, a.slice(2))).toBe(false);
  });
});

// RG-07 : usage unique, expiration courte, plafond de tentatives.
describe("decideOtpAttempt", () => {
  const goodHash = hashOtpCode(SECRET, USER_ID, "123456");
  const wrongHash = hashOtpCode(SECRET, USER_ID, "000000");

  it("accepte le bon code dans la fenêtre de validité", () => {
    expect(decideOtpAttempt(record(), goodHash, NOW)).toEqual({ status: "ok" });
  });

  it("refuse un code déjà utilisé (usage unique)", () => {
    expect(decideOtpAttempt(record({ used: true }), goodHash, NOW).status).toBe("expired");
  });

  it("refuse un code expiré (10 min, ADR-018)", () => {
    const expired = record({ expires_at: new Date(NOW - 1).toISOString() });
    expect(decideOtpAttempt(expired, goodHash, NOW).status).toBe("expired");
    // L'instant pile de l'expiration est déjà expiré.
    const limite = record({ expires_at: new Date(NOW).toISOString() });
    expect(decideOtpAttempt(limite, goodHash, NOW).status).toBe("expired");
  });

  it("décompte les tentatives restantes sur un mauvais code", () => {
    expect(decideOtpAttempt(record({ attempts: 1 }), wrongHash, NOW)).toEqual({
      status: "mismatch",
      remainingAttempts: OTP_MAX_ATTEMPTS - 1,
    });
    expect(decideOtpAttempt(record({ attempts: 4 }), wrongHash, NOW)).toEqual({
      status: "mismatch",
      remainingAttempts: 1,
    });
  });

  it("verrouille à la 5e tentative erronée (ADR-018)", () => {
    expect(decideOtpAttempt(record({ attempts: OTP_MAX_ATTEMPTS }), wrongHash, NOW).status).toBe(
      "locked",
    );
  });

  it("le bon code reste accepté à la 5e et dernière tentative", () => {
    expect(decideOtpAttempt(record({ attempts: OTP_MAX_ATTEMPTS }), goodHash, NOW).status).toBe(
      "ok",
    );
  });

  it("au-delà du plafond (réservation concurrente), tout est verrouillé", () => {
    expect(decideOtpAttempt(record({ attempts: OTP_MAX_ATTEMPTS + 1 }), goodHash, NOW).status).toBe(
      "locked",
    );
  });
});
