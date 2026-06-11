/**
 * État du formulaire « Auto-évaluation » (E-15, useActionState). Module
 * séparé des actions : un fichier "use server" ne peut exporter que des
 * fonctions async (Next 16). Le succès ne passe pas par cet état : l'action
 * redirige vers le détail de la séance avec confirmation.
 */
export type AutoEvaluationFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const AUTO_EVALUATION_FORM_IDLE: AutoEvaluationFormState = { status: "idle" };
