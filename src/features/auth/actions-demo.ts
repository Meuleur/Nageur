"use server";

import { notFound, redirect } from "next/navigation";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAuthEvent } from "@/server/auth/audit";
import { clearPending2faCookie, readPending2fa } from "@/server/auth/cookies";
import { establishVerifiedSession } from "@/server/auth/session";
import { estModeDemo } from "@/server/demo";

import { ROLE_HOME } from "./routes";

/**
 * DÉMO (branche demo UNIQUEMENT) — saut du second facteur sur E-02.
 * La garde `estModeDemo()` est la PREMIÈRE ligne : hors `DEMO_MODE=true`,
 * l'action répond 404 sans rien lire ni écrire. Le cookie signé
 * « pending-2fa » reste exigé : seul un utilisateur qui a déjà franchi le
 * mot de passe (étape 1 du gating C1) peut sauter l'OTP — le saut ne crée
 * aucune session pour un visiteur anonyme.
 */
export async function skipOtpDemoAction(): Promise<void> {
  if (!estModeDemo()) {
    notFound();
  }

  let destination: string | null = null;
  try {
    const pending = await readPending2fa();
    if (pending) {
      // L'adresse e-mail vient du compte (jamais du client), comme dans
      // verifyOtpAction.
      const service = createServiceRoleClient();
      const { data: userData, error: userError } = await service.auth.admin.getUserById(
        pending.sub,
      );
      if (!userError && userData.user?.email) {
        const role = await establishVerifiedSession(userData.user.email);
        await clearPending2faCookie();
        await logAuthEvent("auth.otp_verified", {
          actorId: pending.sub,
          metadata: { demo: true },
        });
        destination = ROLE_HOME[role];
      }
    }
  } catch {
    destination = null;
  }

  if (!destination) {
    redirect("/connexion?motif=session-2fa-expiree");
  }
  redirect(destination);
}
