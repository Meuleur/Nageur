"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginAction } from "@/features/auth/actions";
import { AUTH_FORM_IDLE } from "@/features/auth/form-state";
import { loginSchema } from "@/features/auth/schemas";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { useClientValidation } from "./use-client-validation";

/** E-01 — Connexion (premier facteur). La suite (OTP) arrive sur E-02. */
export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, AUTH_FORM_IDLE);
  const { clientErrors, onSubmit } = useClientValidation(loginSchema);
  const errors = { ...state.fieldErrors, ...clientErrors };

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={errors.email}
        onChange={(event) => {
          // Conservée pour E-03 (renvoi de l'e-mail de vérification) si la
          // connexion révèle un compte non vérifié. Jamais dans l'URL (D3).
          window.sessionStorage.setItem("verification-email-adresse", event.currentTarget.value);
        }}
      />
      <FormField
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors.password}
      />

      <SubmitButton pendingLabel="Vérification…">Se connecter</SubmitButton>

      <p className="text-center">
        <Link
          href="/mot-de-passe-oublie"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Mot de passe oublié&nbsp;?
        </Link>
      </p>
    </form>
  );
}
