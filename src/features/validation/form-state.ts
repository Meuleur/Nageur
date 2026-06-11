/**
 * États des formulaires du cycle de validation (E-22/E-23, useActionState).
 * Module séparé des actions : un fichier "use server" ne peut exporter que
 * des fonctions async (Next 16). Le succès ne passe pas par ces états : les
 * actions redirigent vers le détail avec le retour visuel (B2).
 */

export type TraitementFormState = {
  status: "idle" | "error";
  message?: string;
  /** RG-29 : erreur ciblée sous le champ commentaire au refus. */
  fieldErrors?: { commentaire?: string[] };
};

export const TRAITEMENT_FORM_IDLE: TraitementFormState = { status: "idle" };

export type ModificationFormState = {
  status: "idle" | "error";
  message?: string;
  /** Messages localisés par champ (« Série 2 : … »), prêts à afficher. */
  erreurs?: string[];
};

export const MODIFICATION_FORM_IDLE: ModificationFormState = { status: "idle" };
