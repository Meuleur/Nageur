import type { Metadata } from "next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthTabs } from "@/features/auth/components/auth-tabs";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Connexion — App Natation" };

/** Messages contextuels au retour d'un autre parcours (B2 : états explicites). */
const NOTICES: Record<string, { variant: "default" | "success"; text: string }> = {
  "email-verifie": {
    variant: "success",
    text: "Adresse e-mail vérifiée. Vous pouvez maintenant vous connecter.",
  },
  "mot-de-passe-modifie": {
    variant: "success",
    text: "Mot de passe modifié. Toutes vos sessions ont été déconnectées : reconnectez-vous.",
  },
  "session-2fa-expiree": {
    variant: "default",
    text: "Votre session de connexion a expiré. Reconnectez-vous.",
  },
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string }>;
}) {
  const { motif } = await searchParams;
  const notice = motif ? NOTICES[motif] : undefined;

  return (
    <div className="space-y-4">
      <AuthTabs active="connexion" />
      <Card>
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>
            E-mail et mot de passe, puis code de confirmation reçu par e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice ? (
            <Alert variant={notice.variant}>
              <AlertDescription>{notice.text}</AlertDescription>
            </Alert>
          ) : null}
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
