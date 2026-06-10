/**
 * État du formulaire « Mon profil » (useActionState). Module séparé des
 * actions : un fichier "use server" ne peut exporter que des fonctions async
 * (Next 16).
 */
export type ProfilFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const PROFIL_FORM_IDLE: ProfilFormState = { status: "idle" };
