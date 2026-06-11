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

type GenerationUser = { email: string; coachEmail: string };

/**
 * Génération nominale (E-12) : profil complet, aucune séance seedée.
 * coachEmail (Sacha, partagé par les comptes CH5) sert à vérifier N4
 * (RG-36) dans Mailpit — assertions sans identifiant de séance : les deux
 * projets Playwright peuvent lui écrire en parallèle.
 */
const GENERATION_USERS: Record<string, GenerationUser> = {
  chromium: { email: "ines.nageur@nageur.test", coachEmail: "sacha.coach@nageur.test" },
  "mobile-chrome": { email: "eva.nageur@nageur.test", coachEmail: "sacha.coach@nageur.test" },
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

/**
 * CH6 — parcours coach (E-20 à E-24), un COACH par test ET par projet
 * Playwright (mêmes contraintes OTP que les nageurs). Chaque coach suit son
 * propre nageur seedé ; les séances consommées (valider/modifier/refuser)
 * sont remises à zéro par global-setup via reseed_ch6_e2e() (seed.sql).
 */

/** nageurEmail : boîte Mailpit du nageur suivi — vérification N5/N6/N7 (RG-37). */
type CoachValiderUser = { email: string; nageur: string; nageurEmail: string };

/** Tableau de bord + file + valider (E-20/E-21/E-22, T2) + isolation RG-25. */
const COACH_VALIDER_USERS: Record<string, CoachValiderUser> = {
  chromium: {
    email: "remi.coach@nageur.test",
    nageur: "Anna Faure",
    nageurEmail: "anna.nageur@nageur.test",
  },
  "mobile-chrome": {
    email: "lucie.coach@nageur.test",
    nageur: "Élio Brun",
    nageurEmail: "elio.nageur@nageur.test",
  },
};

/** Modifier puis valider (E-23, T3) : une séance en attente à deux séries. */
const COACH_MODIFIER_USERS: Record<string, CoachValiderUser> = {
  chromium: {
    email: "david.coach@nageur.test",
    nageur: "Maya Robin",
    nageurEmail: "maya.nageur@nageur.test",
  },
  "mobile-chrome": {
    email: "sara.coach@nageur.test",
    nageur: "Nino Costa",
    nageurEmail: "nino.nageur@nageur.test",
  },
};

/** Refuser (E-22, T4, RG-29) : une séance en attente. */
const COACH_REFUSER_USERS: Record<string, CoachValiderUser> = {
  chromium: {
    email: "marc.coach@nageur.test",
    nageur: "Léon Pages",
    nageurEmail: "leon.nageur@nageur.test",
  },
  "mobile-chrome": {
    email: "nina.coach@nageur.test",
    nageur: "Rose Vidal",
    nageurEmail: "rose.nageur@nageur.test",
  },
};

type CoachNageursUser = {
  email: string;
  nageur: string;
  niveau: string;
  ressenti: string;
  autoEvaluation: string;
};

/** Mes nageurs + historique + auto-évaluations (E-24, RG-35) — lecture seule. */
const COACH_NAGEURS_USERS: Record<string, CoachNageursUser> = {
  chromium: {
    email: "iris.coach@nageur.test",
    nageur: "Timo Adam",
    niveau: "Confirmé",
    ressenti: "4 / 5",
    autoEvaluation: "Très bonne séance, fin un peu dure.",
  },
  "mobile-chrome": {
    email: "loic.coach@nageur.test",
    nageur: "Cléo Bodin",
    niveau: "Intermédiaire",
    ressenti: "3 / 5",
    autoEvaluation: "Reprise correcte.",
  },
};

/**
 * CH8 — espace admin (E-30 à E-33), un compte SUPER ADMIN par test ET par
 * projet Playwright. Le test fournisseurs ne tourne que sur chromium (le
 * fournisseur actif est un état GLOBAL, RG-38 — deux projets en parallèle
 * se marcheraient dessus) ; reseed_ch8_e2e() remet affectations, coachs
 * invités et fournisseurs à l'état seed.
 */

/** Tableau de bord métriques (E-30). */
const ADMIN_METRIQUES_USERS: Record<string, string> = {
  chromium: "gael.admin@nageur.test",
  "mobile-chrome": "kenza.admin@nageur.test",
};

/** Fournisseurs LLM (E-31) — chromium uniquement (état global). */
const ADMIN_FOURNISSEURS_USERS: Record<string, string> = {
  chromium: "hana.admin@nageur.test",
  "mobile-chrome": "lior.admin@nageur.test",
};

type AdminAffectationUser = {
  email: string;
  nageur: string;
  nageurEmail: string;
  coach: string;
};

/** Affectations + N8 (E-32) : Lou/Maé seedés SANS coach, cible Sacha. */
const ADMIN_AFFECTATION_USERS: Record<string, AdminAffectationUser> = {
  chromium: {
    email: "igor.admin@nageur.test",
    nageur: "Lou Marin",
    nageurEmail: "lou.nageur@nageur.test",
    coach: "Sacha Royer",
  },
  "mobile-chrome": {
    email: "milo.admin@nageur.test",
    nageur: "Maé Garnier",
    nageurEmail: "mae.nageur@nageur.test",
    coach: "Sacha Royer",
  },
};

type AdminInvitationUser = {
  email: string;
  invitePrenom: string;
  inviteNom: string;
  inviteEmail: string;
};

/** Invitation coach (E-33) — comptes invités supprimés par reseed_ch8_e2e. */
const ADMIN_INVITATION_USERS: Record<string, AdminInvitationUser> = {
  chromium: {
    email: "jana.admin@nageur.test",
    invitePrenom: "Rita",
    inviteNom: "Sauveterre",
    inviteEmail: "invite.chromium@nageur.test",
  },
  "mobile-chrome": {
    email: "nora.admin@nageur.test",
    invitePrenom: "Ugo",
    inviteNom: "Valette",
    inviteEmail: "invite.mobile@nageur.test",
  },
};

type AccesRefuseUser = { nageurEmail: string; coachEmail: string };

/** L'espace admin est interdit aux autres rôles (RG-03/RG-40). */
const ACCES_REFUSE_USERS: Record<string, AccesRefuseUser> = {
  chromium: { nageurEmail: "nour.nageur@nageur.test", coachEmail: "oscar.coach@nageur.test" },
  "mobile-chrome": { nageurEmail: "sam.nageur@nageur.test", coachEmail: "prune.coach@nageur.test" },
};

type ParcoursUser = { adminEmail: string; coach: string; coachEmail: string };

/**
 * CH9 — parcours critique bout-en-bout : admin + coach dédiés par projet,
 * le nageur est créé dynamiquement par le test (e2e-parcours-…@nageur.test,
 * purgé par reseed_ch9_e2e).
 */
const PARCOURS_USERS: Record<string, ParcoursUser> = {
  chromium: {
    adminEmail: "wanda.admin@nageur.test",
    coach: "Ugo Vidal",
    coachEmail: "ugo.coach@nageur.test",
  },
  "mobile-chrome": {
    adminEmail: "yael.admin@nageur.test",
    coach: "Vera Munoz",
    coachEmail: "vera.coach@nageur.test",
  },
};

/**
 * CH9 — séance seedée d'un AUTRE nageur (Jade / Lina, jeux en lecture seule
 * de CH5) : l'isolation RLS par URL directe doit répondre « introuvable ».
 */
const SEANCE_AUTRE_NAGEUR: Record<string, string> = {
  chromium: "40000000-0000-4000-8000-000000000008",
  "mobile-chrome": "40000000-0000-4000-8000-000000000012",
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
export const regenerationUserFor = (testInfo: TestInfo) => forProject(REGENERATION_USERS, testInfo);
export const listeUserFor = (testInfo: TestInfo) => forProject(LISTE_USERS, testInfo);
export const detailUserFor = (testInfo: TestInfo) => forProject(DETAIL_USERS, testInfo);
export const coachValiderFor = (testInfo: TestInfo) => forProject(COACH_VALIDER_USERS, testInfo);
export const coachModifierFor = (testInfo: TestInfo) => forProject(COACH_MODIFIER_USERS, testInfo);
export const coachRefuserFor = (testInfo: TestInfo) => forProject(COACH_REFUSER_USERS, testInfo);
export const coachNageursFor = (testInfo: TestInfo) => forProject(COACH_NAGEURS_USERS, testInfo);
export const adminMetriquesFor = (testInfo: TestInfo) =>
  forProject(ADMIN_METRIQUES_USERS, testInfo);
export const adminFournisseursFor = (testInfo: TestInfo) =>
  forProject(ADMIN_FOURNISSEURS_USERS, testInfo);
export const adminAffectationFor = (testInfo: TestInfo) =>
  forProject(ADMIN_AFFECTATION_USERS, testInfo);
export const adminInvitationFor = (testInfo: TestInfo) =>
  forProject(ADMIN_INVITATION_USERS, testInfo);
export const accesRefuseFor = (testInfo: TestInfo) => forProject(ACCES_REFUSE_USERS, testInfo);
export const parcoursFor = (testInfo: TestInfo) => forProject(PARCOURS_USERS, testInfo);
export const seanceAutreNageurFor = (testInfo: TestInfo) =>
  forProject(SEANCE_AUTRE_NAGEUR, testInfo);
