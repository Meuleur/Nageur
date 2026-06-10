import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";
import { readResetToken } from "@/server/auth/cookies";

export const metadata: Metadata = { title: "Nouveau mot de passe — App Natation" };

/**
 * E-04 (étape 2) — Définition du nouveau mot de passe. Accessible uniquement
 * après un lien de réinitialisation valide (cookie signé posé par
 * /auth/confirm — aucune session Supabase à ce stade, gating C1).
 */
export default async function ReinitialisationPage() {
  const reset = await readResetToken();
  if (!reset) {
    redirect("/mot-de-passe-oublie?motif=lien-expire");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Définir un nouveau mot de passe</CardTitle>
        <CardDescription>
          Choisissez un nouveau mot de passe conforme à la politique de sécurité.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm />
      </CardContent>
    </Card>
  );
}
