"use client";

import { useState } from "react";
import { z } from "zod";

export type FieldErrorMap = Record<string, string[] | undefined>;

/**
 * Validation client des formulaires d'auth (D2) : le MÊME schéma Zod que le
 * serveur, exécuté avant l'envoi pour un retour immédiat. La soumission
 * native (server action) n'est interceptée qu'en cas d'erreur — sans
 * JavaScript, la validation serveur reste seule juge (sécurité, C1).
 */
export function useClientValidation(schema: z.ZodType) {
  const [clientErrors, setClientErrors] = useState<FieldErrorMap>({});

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(z.flattenError(parsed.error).fieldErrors as FieldErrorMap);
      return;
    }
    setClientErrors({});
  };

  return { clientErrors, onSubmit };
}
