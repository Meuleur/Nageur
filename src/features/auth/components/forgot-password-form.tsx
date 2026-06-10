"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { AUTH_FORM_IDLE } from "@/features/auth/form-state";
import { emailOnlySchema } from "@/features/auth/schemas";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { useClientValidation } from "./use-client-validation";

/** E-04 (étape 1) — Demande de réinitialisation (RG-09, réponse générique C1). */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, AUTH_FORM_IDLE);
  const { clientErrors, onSubmit } = useClientValidation(emailOnlySchema);
  const errors = { ...state.fieldErrors, ...clientErrors };

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status !== "idle" && state.message ? (
        <Alert variant={state.status === "success" ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        hint="Si un compte existe pour cette adresse, vous recevrez un lien valable 1 heure."
        errors={errors.email}
      />

      <SubmitButton pendingLabel="Envoi…">Envoyer le lien de réinitialisation</SubmitButton>

      <p className="text-center">
        <Link href="/connexion" className="text-sm text-primary underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
