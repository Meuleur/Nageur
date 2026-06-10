import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationEmailPanel } from "@/features/auth/components/verification-email-panel";

export const metadata: Metadata = { title: "Vérifiez votre e-mail — App Natation" };

const NOTICES: Record<string, { variant: "default" | "destructive"; text: string }> = {
  "non-verifie": {
    variant: "default",
    text: "Votre adresse e-mail n'est pas encore vérifiée : l'accès à l'application est bloqué d'ici là. Cliquez sur le lien reçu par e-mail, ou renvoyez-le ci-dessous.",
  },
  "lien-invalide": {
    variant: "destructive",
    text: "Ce lien de vérification est invalide ou a expiré. Renvoyez un nouvel e-mail ci-dessous.",
  },
};

/** E-03 — Vérification d'e-mail post-inscription (PN-1, RG-05). */
export default async function VerificationEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string }>;
}) {
  const { motif } = await searchParams;
  const notice = motif ? NOTICES[motif] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérifiez votre adresse e-mail</CardTitle>
        <CardDescription>
          Un e-mail de vérification vous a été envoyé. Cliquez sur le lien qu&apos;il contient
          (valable 24&nbsp;heures) pour activer votre compte, puis connectez-vous.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? (
          <Alert variant={notice.variant}>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}
        <VerificationEmailPanel />
        <p className="text-center">
          <Link
            href="/connexion"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
