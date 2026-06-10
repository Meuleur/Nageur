/**
 * État partagé des formulaires d'authentification (useActionState).
 * Module séparé des actions : un fichier "use server" ne peut exporter que
 * des fonctions async (Next 16).
 */
export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** E-02 : tentatives restantes sur le code courant (RG-07). */
  remainingAttempts?: number;
  /** E-02 : échéance du code / de l'état d'attente (epoch ms, compte à rebours). */
  otpExpiresAt?: number;
  /** E-02 : anti-spam de renvoi — patienter avant le prochain envoi. */
  resendAvailableInSeconds?: number;
};

export const AUTH_FORM_IDLE: AuthFormState = { status: "idle" };
