/**
 * États des formulaires admin (E-31 à E-33) — hors du fichier "use server"
 * (un module "use server" n'exporte que des fonctions async, piège Next 16).
 */

export type AdminFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const ADMIN_FORM_IDLE: AdminFormState = { status: "idle" };
