import type { Metadata } from "next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié — App Natation" };

/** E-04 (étape 1) — Demande de lien de réinitialisation (RG-09). */
export default async function MotDePasseOubliePage({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string }>;
}) {
  const { motif } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          Indiquez l&apos;adresse e-mail de votre compte&nbsp;: nous vous enverrons un lien pour
          définir un nouveau mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {motif === "lien-expire" ? (
          <Alert variant="destructive">
            <AlertDescription>
              Ce lien de réinitialisation est invalide ou a expiré (validité&nbsp;: 1&nbsp;heure).
              Demandez un nouveau lien ci-dessous.
            </AlertDescription>
          </Alert>
        ) : null}
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
