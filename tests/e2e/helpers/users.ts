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

/**
 * CH5 — parcours séances (E-12 à E-15), comptes dédiés par test (coach :
 * Sacha Royer). Les séances seedées portent des UUID fixes (seed.sql) ;
 * global-setup purge ce que les tests créent (séances générées,
 * auto-évaluations) pour des suites rejouables.
 */

/** Génération nominale (E-12) : profil complet, aucune séance seedée. */
const GENERATION_USERS: Record<string, string> = {
  chromium: "ines.nageur@nageur.test",
  "mobile-chrome": "eva.nageur@nageur.test",
};

type RegenerationUser = { email: string; commentaireRefus: string };

/** Refus → régénération (PN-8, RG-33) : une séance refusée seedée. */
const REGENERATION_USERS: Record<string, RegenerationUser> = {
  chromium: {
    email: "mael.nageur@nageur.test",
    commentaireRefus: "Trop de volume cette semaine, on repart sur plus léger.",
  },
  "mobile-chrome": {
    email: "yanis.nageur@nageur.test",
    commentaireRefus: "On revoit la technique avant d'enchaîner ce type de séance.",
  },
};

type ListeUser = { email: string; seanceEnAttenteId: string; consigneSerieEnAttente: string };

/** Liste + filtre + en attente non utilisable (E-13) : les 4 statuts seedés. */
const LISTE_USERS: Record<string, ListeUser> = {
  chromium: {
    email: "jade.nageur@nageur.test",
    seanceEnAttenteId: "40000000-0000-4000-8000-000000000008",
    consigneSerieEnAttente: "Respiration 3 temps.",
  },
  "mobile-chrome": {
    email: "lina.nageur@nageur.test",
    seanceEnAttenteId: "40000000-0000-4000-8000-000000000012",
    consigneSerieEnAttente: "Allure régulière.",
  },
};

type DetailUser = {
  email: string;
  commentaireCoach: string;
  serie: string;
  distanceTotale: RegExp;
};

/** Détail utilisable + auto-évaluation (E-14/E-15) : une séance validée seedée. */
const DETAIL_USERS: Record<string, DetailUser> = {
  chromium: {
    email: "louis.nageur@nageur.test",
    commentaireCoach: "Belle séance, garde le rythme sur les cent mètres.",
    serie: "6 × 100 m — Crawl",
    distanceTotale: /1\s*400 m/,
  },
  "mobile-chrome": {
    email: "hugo.nageur@nageur.test",
    commentaireCoach: "Bon volume pour reprendre en douceur.",
    serie: "5 × 100 m — Crawl",
    distanceTotale: /1\s*000 m/,
  },
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
export const generationUserFor = (testInfo: TestInfo) => forProject(GENERATION_USERS, testInfo);
export const regenerationUserFor = (testInfo: TestInfo) =>
  forProject(REGENERATION_USERS, testInfo);
export const listeUserFor = (testInfo: TestInfo) => forProject(LISTE_USERS, testInfo);
export const detailUserFor = (testInfo: TestInfo) => forProject(DETAIL_USERS, testInfo);
