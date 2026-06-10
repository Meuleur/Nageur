import { z } from "zod";

import {
  getPasswordIssues,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_CATEGORIES,
  PASSWORD_MIN_LENGTH,
  type PasswordIssue,
} from "./password";

/**
 * Schémas Zod des formulaires d'authentification (C1/B2) — source unique,
 * appliquée côté client (UX) ET côté serveur (sécurité, D2).
 */
const PASSWORD_ISSUE_MESSAGES: Record<PasswordIssue, string> = {
  longueur: `Au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  categories: `Au moins ${PASSWORD_MIN_CATEGORIES} catégories parmi : minuscules, majuscules, chiffres, symboles.`,
  courant: "Ce mot de passe est trop courant.",
};

export const passwordSchema = z
  .string("Mot de passe requis.")
  .max(PASSWORD_MAX_LENGTH, `Au plus ${PASSWORD_MAX_LENGTH} caractères.`)
  .superRefine((password, ctx) => {
    for (const issue of getPasswordIssues(password)) {
      ctx.addIssue({ code: "custom", message: PASSWORD_ISSUE_MESSAGES[issue] });
    }
  });

const emailSchema = z
  .string("Adresse e-mail requise.")
  .trim()
  .toLowerCase()
  .max(254, "Adresse e-mail trop longue.")
  .pipe(z.email("Adresse e-mail invalide."));

const nameSchema = (label: string) =>
  z.string(`${label} requis.`).trim().min(1, `${label} requis.`).max(50, "Au plus 50 caractères.");

/** Inscription nageur (RG-02, E-01). */
export const signupSchema = z.object({
  prenom: nameSchema("Prénom"),
  nom: nameSchema("Nom"),
  email: emailSchema,
  password: passwordSchema,
});

/** Connexion, premier facteur (RG-06, E-01). */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string("Mot de passe requis.")
    .min(1, "Mot de passe requis.")
    .max(PASSWORD_MAX_LENGTH, "Mot de passe invalide."),
});

/** Second facteur (RG-06/RG-07, E-02). */
export const otpSchema = z.object({
  code: z
    .string("Code requis.")
    .trim()
    .regex(/^[0-9]{6}$/, "Le code comporte 6 chiffres."),
});

/** Demande de réinitialisation (RG-09, E-04) et renvoi de vérification (E-03). */
export const emailOnlySchema = z.object({
  email: emailSchema,
});

/** Définition du nouveau mot de passe (RG-09, E-04). */
export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string("Confirmation requise."),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmation) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Les deux mots de passe ne correspondent pas.",
      });
    }
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
