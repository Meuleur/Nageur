/**
 * Cartographie des routes liées à l'authentification (B2, RG-03) — module
 * pur, partagé entre le proxy (protection), les actions serveur
 * (redirections par rôle) et les écrans.
 */
export type AppRole = "nageur" | "coach" | "super_admin";

/** Accueil de chaque rôle après authentification complète (E-10/E-20/E-30). */
export const ROLE_HOME: Record<AppRole, string> = {
  nageur: "/accueil",
  coach: "/coach",
  super_admin: "/admin",
};

/** Préfixes protégés : exigent une session établie ET le bon rôle (RG-03). */
export const PROTECTED_PREFIXES: ReadonlyArray<{ prefix: string; role: AppRole }> = [
  { prefix: "/accueil", role: "nageur" },
  { prefix: "/profil", role: "nageur" },
  { prefix: "/seances", role: "nageur" },
  { prefix: "/coach", role: "coach" },
  { prefix: "/admin", role: "super_admin" },
];

/** Écrans d'authentification (E-01 à E-04) — interdits une fois connecté. */
export const AUTH_PAGES: readonly string[] = [
  "/connexion",
  "/inscription",
  "/verification-2fa",
  "/verification-email",
  "/mot-de-passe-oublie",
  "/reinitialisation",
];
