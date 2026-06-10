"use client";

import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { updatePasswordAction } from "@/features/auth/actions";
import { AUTH_FORM_IDLE } from "@/features/auth/form-state";
import { newPasswordSchema } from "@/features/auth/schemas";

import { FormField } from "./form-field";
import { PasswordStrength } from "./password-strength";
import { SubmitButton } from "./submit-button";
import { useClientValidation } from "./use-client-validation";

/** E-04 (étape 2) — Nouveau mot de passe (politique ADR-018, robustesse). */
export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, AUTH_FORM_IDLE);
  const { clientErrors, onSubmit } = useClientValidation(newPasswordSchema);
  const [password, setPassword] = useState("");
  const errors = { ...state.fieldErrors, ...clientErrors };

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <FormField
          label="Nouveau mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          errors={errors.password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <PasswordStrength password={password} />
      </div>
      <FormField
        label="Confirmer le mot de passe"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        required
        errors={errors.confirmation}
      />

      <SubmitButton pendingLabel="Enregistrement…">Définir ce mot de passe</SubmitButton>

      <p className="text-caption text-muted-foreground">
        Après le changement, toutes vos sessions actives seront déconnectées et vous devrez vous
        reconnecter.
      </p>
    </form>
  );
}
