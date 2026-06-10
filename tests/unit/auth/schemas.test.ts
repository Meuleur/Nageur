import { describe, expect, it } from "vitest";

import {
  emailOnlySchema,
  loginSchema,
  newPasswordSchema,
  otpSchema,
  signupSchema,
} from "@/features/auth/schemas";

// Schémas partagés client/serveur (D2) — mêmes règles des deux côtés.
describe("signupSchema", () => {
  const valid = {
    prenom: "Léa",
    nom: "Petit",
    email: "lea@exemple.fr",
    password: "Cascade!Bleu7",
  };

  it("accepte une inscription valide", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("normalise l'e-mail (espaces, casse)", () => {
    const parsed = signupSchema.safeParse({ ...valid, email: "  Lea@Exemple.FR " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("lea@exemple.fr");
    }
  });

  it("rejette un e-mail invalide", () => {
    expect(signupSchema.safeParse({ ...valid, email: "pas-un-email" }).success).toBe(false);
  });

  it("rejette prénom/nom vides ou trop longs (contrainte profiles 1..50)", () => {
    expect(signupSchema.safeParse({ ...valid, prenom: "  " }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, nom: "x".repeat(51) }).success).toBe(false);
  });

  it("applique la politique de mot de passe (ADR-018)", () => {
    expect(signupSchema.safeParse({ ...valid, password: "court1!" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "Password123!" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("exige e-mail valide et mot de passe non vide", () => {
    expect(loginSchema.safeParse({ email: "a@b.fr", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.fr", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("n'applique PAS la politique de robustesse à la connexion", () => {
    // Un compte ancien doit pouvoir se connecter même si la politique évolue.
    expect(loginSchema.safeParse({ email: "a@b.fr", password: "faible" }).success).toBe(true);
  });
});

describe("otpSchema", () => {
  it("accepte un code à 6 chiffres (espaces tolérés autour)", () => {
    expect(otpSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(otpSchema.safeParse({ code: " 123456 " }).success).toBe(true);
  });

  it("rejette tout autre format", () => {
    expect(otpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "1234567" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "abcdef" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "12 345" }).success).toBe(false);
  });
});

describe("emailOnlySchema", () => {
  it("valide l'adresse", () => {
    expect(emailOnlySchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
    expect(emailOnlySchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("exige la confirmation identique", () => {
    const ok = newPasswordSchema.safeParse({
      password: "Cascade!Bleu7",
      confirmation: "Cascade!Bleu7",
    });
    expect(ok.success).toBe(true);

    const ko = newPasswordSchema.safeParse({
      password: "Cascade!Bleu7",
      confirmation: "Autre!Chose9",
    });
    expect(ko.success).toBe(false);
    if (!ko.success) {
      expect(ko.error.issues.some((issue) => issue.path.includes("confirmation"))).toBe(true);
    }
  });

  it("applique la politique au nouveau mot de passe", () => {
    expect(newPasswordSchema.safeParse({ password: "court", confirmation: "court" }).success).toBe(
      false,
    );
  });
});
