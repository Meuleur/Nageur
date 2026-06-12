import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { skipOtpDemoAction } from "@/features/auth/actions-demo";
import { OtpForm } from "@/features/auth/components/otp-form";
import { readPending2fa } from "@/server/auth/cookies";
import { estModeDemo } from "@/server/demo";

export const metadata: Metadata = { title: "Vérification en deux étapes — App Natation" };

/**
 * E-02 — Second facteur (RG-06). Accessible uniquement avec un état
 * « OTP en attente » valide (cookie signé posé après le mot de passe) ;
 * il n'existe AUCUNE session à ce stade (gating C1).
 * En DEMO_MODE (branche demo) : aucun code n'a été envoyé — un bouton
 * « Passer (démo) » remplace la saisie (skipOtpDemoAction, gardée serveur).
 */
export default async function Verification2faPage() {
  const pending = await readPending2fa();
  if (!pending) {
    redirect("/connexion?motif=session-2fa-expiree");
  }

  const demo = estModeDemo();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérification en deux étapes</CardTitle>
        <CardDescription>
          {demo
            ? "Mode démo : la 2FA est désactivée — aucun code ne vous a été envoyé. Continuez avec le bouton ci-dessous."
            : "Un code à 6 chiffres vient de vous être envoyé par e-mail. Saisissez-le pour terminer votre connexion."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {demo ? (
          <form action={skipOtpDemoAction}>
            <Button type="submit" className="w-full">
              Passer (démo)
            </Button>
          </form>
        ) : (
          <OtpForm initialExpiresAt={pending.exp} />
        )}
      </CardContent>
    </Card>
  );
}
