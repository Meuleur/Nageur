"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { signupAction } from "@/features/auth/actions";
import { AUTH_FORM_IDLE } from "@/features/auth/form-state";
import { signupSchema } from "@/features/auth/schemas";

import { FormField } from "./form-field";
import { PasswordStrength } from "./password-strength";
import { SubmitButton } from "./submit-button";
import { useClientValidation } from "./use-client-validation";

/** E-01 — Inscription nageur (PN-1, RG-02). */
export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, AUTH_FORM_IDLE);
  const { clientErrors, onSubmit } = useClientValidation(signupSchema);
  const [password, setPassword] = useState("");
  const errors = { ...state.fieldErrors, ...clientErrors };

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Prénom"
          name="prenom"
          autoComplete="given-name"
          required
          errors={errors.prenom}
        />
        <FormField label="Nom" name="nom" autoComplete="family-name" required errors={errors.nom} />
      </div>
      <FormField
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={errors.email}
        onChange={(event) => {
          // Conservée pour E-03 (renvoi de l'e-mail de vérification).
          window.sessionStorage.setItem("verification-email-adresse", event.currentTarget.value);
        }}
      />
      <div className="space-y-2">
        <FormField
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          errors={errors.password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <PasswordStrength password={password} />
      </div>

      <SubmitButton pendingLabel="Création du compte…">Créer mon compte</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        J&apos;ai déjà un compte&nbsp;:{" "}
        <Link href="/connexion" className="text-primary underline-offset-4 hover:underline">
          me connecter
        </Link>
      </p>
    </form>
  );
}
