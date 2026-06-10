import { describe, expect, it } from "vitest";

import {
  countPasswordCategories,
  evaluatePasswordStrength,
  getPasswordIssues,
  isCommonPassword,
  PASSWORD_MIN_LENGTH,
} from "@/features/auth/password";

// Politique de mot de passe (C1, ADR-018) : ≥ 10 caractères, 3 catégories
// sur 4, rejet des mots de passe manifestement faibles.
describe("countPasswordCategories", () => {
  it("compte les 4 catégories", () => {
    expect(countPasswordCategories("abc")).toBe(1);
    expect(countPasswordCategories("abcABC")).toBe(2);
    expect(countPasswordCategories("abcABC123")).toBe(3);
    expect(countPasswordCategories("abcABC123!")).toBe(4);
  });

  it("classe tout caractère non alphanumérique comme symbole", () => {
    expect(countPasswordCategories("éàç")).toBe(1);
    expect(countPasswordCategories(" ")).toBe(1);
  });
});

describe("isCommonPassword", () => {
  it("rejette les classiques", () => {
    expect(isCommonPassword("password")).toBe(true);
    expect(isCommonPassword("azerty")).toBe(true);
    expect(isCommonPassword("123456")).toBe(true);
  });

  it("rejette les variantes décorées d'un noyau courant (Password123!)", () => {
    expect(isCommonPassword("Password123!")).toBe(true);
    expect(isCommonPassword("MOTDEPASSE2026")).toBe(true);
    expect(isCommonPassword("natation!!")).toBe(true);
  });

  it("accepte un mot de passe original", () => {
    expect(isCommonPassword("Cascade!Bleu7")).toBe(false);
    expect(isCommonPassword("GrandeNatation2026!")).toBe(false);
  });
});

describe("getPasswordIssues", () => {
  it("signale la longueur insuffisante (< 10)", () => {
    expect(getPasswordIssues("Abc123!")).toContain("longueur");
  });

  it("signale moins de 3 catégories", () => {
    expect(getPasswordIssues("abcdefghijkl")).toContain("categories");
    expect(getPasswordIssues("abcdefgh1234")).toContain("categories");
  });

  it("signale un mot de passe courant", () => {
    expect(getPasswordIssues("Password123!")).toContain("courant");
  });

  it("accepte un mot de passe conforme ADR-018 (10 caractères, 3 catégories)", () => {
    expect(getPasswordIssues("Abcdefgh12")).toEqual([]);
    expect("Abcdefgh12".length).toBe(PASSWORD_MIN_LENGTH);
  });
});

describe("evaluatePasswordStrength", () => {
  it("niveau 0 : vide ou non conforme", () => {
    expect(evaluatePasswordStrength("").level).toBe(0);
    expect(evaluatePasswordStrength("court1!").level).toBe(0);
    expect(evaluatePasswordStrength("Password123!").level).toBe(0);
  });

  it("niveau 1 : conforme au minimum", () => {
    expect(evaluatePasswordStrength("Abcdefgh12")).toEqual({ level: 1, label: "Correct" });
  });

  it("niveau 2 : 12 caractères et plus", () => {
    expect(evaluatePasswordStrength("Abcdefghij12").level).toBe(2);
  });

  it("niveau 3 : 14 caractères et les 4 catégories", () => {
    expect(evaluatePasswordStrength("Abcdefghijk12!")).toEqual({ level: 3, label: "Excellent" });
  });
});
