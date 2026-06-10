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

type ProfilUser = { email: string; coach: string; coachEmail: string };

/**
 * CH3 — profil (E-11) : comptes AVEC coach, profil sportif vierge à chaque
 * suite (purgé par global-setup). L'e-mail du coach sert à vérifier qu'il
 * n'apparaît jamais côté nageur (ADR-024).
 */
const PROFIL_USERS: Record<string, ProfilUser> = {
  chromium: {
    email: "mia.nageur@nageur.test",
    coach: "Camille Durand",
    coachEmail: "camille.coach@nageur.test",
  },
  "mobile-chrome": {
    email: "zoe.nageur@nageur.test",
    coach: "Alex Martin",
    coachEmail: "alex.coach@nageur.test",
  },
};

/** CH3 — état sans coach (E-10, RG-13/RG-14). */
const SANS_COACH_USERS: Record<string, string> = {
  chromium: "tom.nageur@nageur.test",
  "mobile-chrome": "theo.nageur@nageur.test",
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
export const profilUserFor = (testInfo: TestInfo) => forProject(PROFIL_USERS, testInfo);
export const sansCoachUserFor = (testInfo: TestInfo) => forProject(SANS_COACH_USERS, testInfo);
