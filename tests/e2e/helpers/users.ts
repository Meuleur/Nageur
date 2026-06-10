import type { TestInfo } from "@playwright/test";

/**
 * Répartition des comptes seedés (supabase/seed.sql) PAR PROJET Playwright :
 * les projets chromium et mobile-chrome tournent en parallèle — deux projets
 * ne doivent jamais partager un compte (codes OTP à usage unique, jetons de
 * récupération écrasés, mots de passe modifiés par le parcours de reset).
 */
export const SEED_PASSWORD = "Password123!";

type LoginUser = { email: string; prenom: string; coach: string | null };

/** Connexion + 2FA : léa (avec coach) / lucas (sans coach, RG-14). */
const LOGIN_USERS: Record<string, LoginUser> = {
  chromium: { email: "lea.nageur@nageur.test", prenom: "Léa", coach: "Camille Durand" },
  "mobile-chrome": { email: "lucas.nageur@nageur.test", prenom: "Lucas", coach: null },
};

/** Réinitialisation : le mot de passe de ces comptes est modifié par le test. */
const RESET_USERS: Record<string, string> = {
  chromium: "noah.nageur@nageur.test",
  "mobile-chrome": "emma.nageur@nageur.test",
};

/** Verrouillage (~10 échecs) : comptes coachs, inutilisés ailleurs. */
const LOCKOUT_USERS: Record<string, string> = {
  chromium: "camille.coach@nageur.test",
  "mobile-chrome": "alex.coach@nageur.test",
};

function forProject<T>(map: Record<string, T>, testInfo: TestInfo): T {
  const value = map[testInfo.project.name];
  if (!value) {
    throw new Error(`Pas de compte E2E défini pour le projet « ${testInfo.project.name} ».`);
  }
  return value;
}

export const loginUserFor = (testInfo: TestInfo) => forProject(LOGIN_USERS, testInfo);
export const resetUserFor = (testInfo: TestInfo) => forProject(RESET_USERS, testInfo);
export const lockoutUserFor = (testInfo: TestInfo) => forProject(LOCKOUT_USERS, testInfo);
