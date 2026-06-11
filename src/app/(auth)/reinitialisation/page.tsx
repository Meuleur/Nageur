import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";
import { readResetToken } from "@/server/auth/cookies";

export const metadata: Metadata = { title: "Nouveau mot de passe — App Natation" };

/**
 * E-04 (étape 2) — Définition du nouveau mot de passe. Accessible uniquement
 * après un lien valide (cookie signé posé par /auth/confirm — aucune session
 * Supabase à ce stade, gating C1). Sert aussi à l'activation d'un compte
 * coach invité (E-33, contexte=invitation) : même parcours sécurisé, seul le
 * libellé change.
 */
export default async function ReinitialisationPage({
  searchParams,
}: {
  searchParams: Promise<{ contexte?: string }>;
}) {
  const reset = await readResetToken();
  if (!reset) {
    redirect("/mot-de-passe-oublie?motif=lien-expire");
  }

  const { contexte } = await searchParams;
  const invitation = contexte === "invitation";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {invitation ? "Activer votre compte coach" : "Définir un nouveau mot de passe"}
        </CardTitle>
        <CardDescription>
          {invitation
            ? "Bienvenue ! Choisissez votre mot de passe pour activer votre compte — vous vous connecterez ensuite avec votre adresse e-mail."
            : "Choisissez un nouveau mot de passe conforme à la politique de sécurité."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm />
      </CardContent>
    </Card>
  );
}
