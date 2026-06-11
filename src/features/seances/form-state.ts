import type { CodeErreurGeneration } from "@/server/llm/errors";

/**
 * État du formulaire « Générer ma séance » (E-12, useActionState). Module
 * séparé de l'action : un fichier "use server" ne peut exporter que des
 * fonctions async (Next 16). Le succès ne passe pas par cet état : l'action
 * redirige vers E-13 avec le message de confirmation (B2).
 */
export type GenerationFormState = {
  status: "idle" | "error";
  message?: string;
  /** RG-23/RG-24 : l'échec LLM autorise une relance immédiate. */
  relancePossible?: boolean;
  /** Préconditions (RG-14/RG-17) : renvoi vers E-10 ou E-11 (B2). */
  code?: CodeErreurGeneration;
};

export const GENERATION_FORM_IDLE: GenerationFormState = { status: "idle" };
