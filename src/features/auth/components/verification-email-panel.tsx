"use client";

import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { resendVerificationAction } from "@/features/auth/actions";
import { AUTH_FORM_IDLE } from "@/features/auth/form-state";
import { emailOnlySchema } from "@/features/auth/schemas";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { useClientValidation } from "./use-client-validation";

/**
 * E-03 — Renvoi de l'e-mail de vérification (RG-05). L'adresse vient de
 * sessionStorage (déposée par les formulaires E-01) — jamais de l'URL (D3) ;
 * à défaut, un champ permet de la saisir.
 */
export function VerificationEmailPanel() {
  const [state, formAction] = useActionState(resendVerificationAction, AUTH_FORM_IDLE);
  const { clientErrors, onSubmit } = useClientValidation(emailOnlySchema);
  const [knownEmail, setKnownEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setKnownEmail(window.sessionStorage.getItem("verification-email-adresse"));
    setReady(true);
  }, []);

  const errors = { ...state.fieldErrors, ...clientErrors };

  if (!ready) {
    return null;
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status !== "idle" && state.message ? (
        <Alert variant={state.status === "success" ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {knownEmail ? (
        <>
          <p className="text-sm text-muted-foreground">
            Adresse concernée&nbsp;: <strong className="text-foreground">{knownEmail}</strong>
          </p>
          <input type="hidden" name="email" value={knownEmail} />
        </>
      ) : (
        <FormField
          label="Adresse e-mail du compte"
          name="email"
          type="email"
          autoComplete="email"
          required
          errors={errors.email}
        />
      )}

      <SubmitButton pendingLabel="Envoi…">Renvoyer l&apos;e-mail de vérification</SubmitButton>
    </form>
  );
}
