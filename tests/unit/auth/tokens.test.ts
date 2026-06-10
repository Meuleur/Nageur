import { describe, expect, it } from "vitest";

import {
  createTransitionToken,
  verifyTransitionToken,
  type TransitionToken,
} from "@/server/auth/tokens";

const SECRET = "secret-de-test-suffisamment-long-0123456789";
const NOW = 1_750_000_000_000;

const payload: TransitionToken = {
  purpose: "pending-2fa",
  sub: "30000000-0000-4000-8000-000000000001",
  authAt: NOW,
  exp: NOW + 10 * 60 * 1000,
};

// Jetons de transition (C1) : seul état navigateur entre les deux facteurs.
describe("createTransitionToken / verifyTransitionToken", () => {
  it("signe puis relit le jeton (aller-retour)", () => {
    const token = createTransitionToken(SECRET, payload);
    expect(verifyTransitionToken(SECRET, "pending-2fa", token, NOW)).toEqual(payload);
  });

  it("refuse un jeton expiré", () => {
    const token = createTransitionToken(SECRET, payload);
    expect(verifyTransitionToken(SECRET, "pending-2fa", token, payload.exp)).toBeNull();
    expect(verifyTransitionToken(SECRET, "pending-2fa", token, payload.exp + 1)).toBeNull();
  });

  it("refuse un usage détourné (purpose différent)", () => {
    const token = createTransitionToken(SECRET, payload);
    expect(verifyTransitionToken(SECRET, "password-reset", token, NOW)).toBeNull();
  });

  it("refuse un contenu falsifié", () => {
    const token = createTransitionToken(SECRET, payload);
    const [body, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    forged.sub = "99999999-0000-4000-8000-000000000099";
    const forgedToken = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
    expect(verifyTransitionToken(SECRET, "pending-2fa", forgedToken, NOW)).toBeNull();
  });

  it("refuse une signature falsifiée ou un autre secret", () => {
    const token = createTransitionToken(SECRET, payload);
    const [body] = token.split(".");
    expect(verifyTransitionToken(SECRET, "pending-2fa", `${body}.AAAA`, NOW)).toBeNull();

    const otherSecret = createTransitionToken("autre-secret-tres-long-0123456789abcdef", payload);
    expect(verifyTransitionToken(SECRET, "pending-2fa", otherSecret, NOW)).toBeNull();
  });

  it("refuse les entrées malformées sans lever d'exception", () => {
    expect(verifyTransitionToken(SECRET, "pending-2fa", undefined, NOW)).toBeNull();
    expect(verifyTransitionToken(SECRET, "pending-2fa", "", NOW)).toBeNull();
    expect(verifyTransitionToken(SECRET, "pending-2fa", "pas-un-jeton", NOW)).toBeNull();
    expect(verifyTransitionToken(SECRET, "pending-2fa", "a.b.c", NOW)).toBeNull();
    expect(verifyTransitionToken(SECRET, "pending-2fa", "%%%.%%%", NOW)).toBeNull();
  });
});
