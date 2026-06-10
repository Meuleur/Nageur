/**
 * Politique de mot de passe (C1, paramètres validés ADR-018) :
 * ≥ 10 caractères, au moins 3 catégories sur 4, rejet des mots de passe
 * manifestement faibles. Module pur, partagé client (indicateur de
 * robustesse, validation de formulaire) et serveur (revalidation).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MIN_CATEGORIES = 3;
/** bcrypt (Supabase Auth) ne hache que les 72 premiers octets. */
export const PASSWORD_MAX_LENGTH = 72;

const CATEGORY_PATTERNS: readonly RegExp[] = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

export function countPasswordCategories(password: string): number {
  return CATEGORY_PATTERNS.reduce((count, pattern) => count + (pattern.test(password) ? 1 : 0), 0);
}

/**
 * Noyaux de mots de passe courants (C1) — comparés après normalisation :
 * « Password123! » se réduit à « password » et est rejeté.
 */
const COMMON_PASSWORD_CORES = new Set([
  "password",
  "passw0rd",
  "motdepasse",
  "azerty",
  "azertyuiop",
  "qwerty",
  "qwertyuiop",
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "abc123",
  "admin",
  "administrateur",
  "bienvenue",
  "welcome",
  "bonjour",
  "salut",
  "soleil",
  "sunshine",
  "natation",
  "nageur",
  "piscine",
  "iloveyou",
  "jetaime",
  "letmein",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "marseille",
  "paris",
  "doudou",
  "loulou",
  "coucou",
  "chocolat",
  "princesse",
  "superman",
  "batman",
  "pokemon",
  "starwars",
  "secret",
  "trustno1",
]);

export function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  const candidates = [lower, lower.replace(/[^a-z0-9]/g, ""), lower.replace(/[^a-z]/g, "")];
  return candidates.some(
    (candidate) => candidate.length > 0 && COMMON_PASSWORD_CORES.has(candidate),
  );
}

export type PasswordIssue = "longueur" | "categories" | "courant";

/** Exigences non satisfaites — vide si le mot de passe est conforme. */
export function getPasswordIssues(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push("longueur");
  }
  if (countPasswordCategories(password) < PASSWORD_MIN_CATEGORIES) {
    issues.push("categories");
  }
  if (isCommonPassword(password)) {
    issues.push("courant");
  }
  return issues;
}

export type PasswordStrength = {
  /** 0 = non conforme, 1..3 = conforme (de « correct » à « excellent »). */
  level: 0 | 1 | 2 | 3;
  label: "Trop faible" | "Correct" | "Bon" | "Excellent";
};

/** Score affiché par l'indicateur de robustesse (C1, E-01/E-04). */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0 || getPasswordIssues(password).length > 0) {
    return { level: 0, label: "Trop faible" };
  }
  if (password.length >= 14 && countPasswordCategories(password) === 4) {
    return { level: 3, label: "Excellent" };
  }
  if (password.length >= 12) {
    return { level: 2, label: "Bon" };
  }
  return { level: 1, label: "Correct" };
}
