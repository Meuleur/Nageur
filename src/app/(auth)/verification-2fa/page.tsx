import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OtpForm } from "@/features/auth/components/otp-form";
import { readPending2fa } from "@/server/auth/cookies";

export const metadata: Metadata = { title: "Vérification en deux étapes — App Natation" };

/**
 * E-02 — Second facteur (RG-06). Accessible uniquement avec un état
 * « OTP en attente » valide (cookie signé posé après le mot de passe) ;
 * il n'existe AUCUNE session à ce stade (gating C1).
 */
export default async function Verification2faPage() {
  const pending = await readPending2fa();
  if (!pending) {
    redirect("/connexion?motif=session-2fa-expiree");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérification en deux étapes</CardTitle>
        <CardDescription>
          Un code à 6 chiffres vient de vous être envoyé par e-mail. Saisissez-le pour terminer
          votre connexion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OtpForm initialExpiresAt={pending.exp} />
      </CardContent>
    </Card>
  );
}
