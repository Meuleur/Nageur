import { NextResponse, type NextRequest } from "next/server";

import { createBareAnonClient } from "@/lib/supabase/anon-server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAuthEvent } from "@/server/auth/audit";
import { buildResetCookie } from "@/server/auth/cookies";

/** Validité applicative du lien de réinitialisation : 1 h (ADR-018). */
const RECOVERY_LINK_TTL_MS = 60 * 60 * 1000;

/**
 * Cible des liens e-mail (gabarits supabase/templates, invitation CH8) :
 *   - type=signup   → vérification d'adresse post-inscription (E-03, RG-05) ;
 *   - type=recovery → ouverture du parcours de réinitialisation (E-04) ;
 *   - type=invite   → activation d'un compte coach invité (E-33, RG-02).
 *
 * Gating C1 : consommer un lien e-mail n'authentifie JAMAIS — le jeton est
 * vérifié via un client sans persistance, la session technique créée par
 * GoTrue est révoquée immédiatement, et aucun cookie de session n'est posé.
 * Seul le parcours mot de passe + OTP établit une session.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!tokenHash || (type !== "signup" && type !== "recovery" && type !== "invite")) {
    return redirectTo("/connexion");
  }

  const service = createServiceRoleClient();

  if (type === "recovery") {
    // ADR-018 : lien de reset valable 1 h — contrôlé AVANT consommation
    // (GoTrue n'a qu'une expiration globale de 24 h, cf. config.toml).
    const { data: issuedAt, error } = await service.rpc("recovery_token_issued_at", {
      p_token_hash: tokenHash,
    });
    if (error || !issuedAt || new Date(issuedAt).getTime() + RECOVERY_LINK_TTL_MS <= Date.now()) {
      return redirectTo("/mot-de-passe-oublie?motif=lien-expire");
    }
  }

  const bare = createBareAnonClient();
  const { data, error } = await bare.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    if (type === "invite") {
      return redirectTo("/connexion?motif=invitation-expiree");
    }
    return redirectTo(
      type === "signup"
        ? "/verification-email?motif=lien-invalide"
        : "/mot-de-passe-oublie?motif=lien-expire",
    );
  }

  // Révocation de la session technique créée par la vérification (scope
  // local : les autres sessions du compte ne tombent qu'au changement
  // effectif de mot de passe, ADR-018). Best effort — le jeton n'a de toute
  // façon jamais quitté cette requête.
  if (data.session) {
    await service.auth.admin.signOut(data.session.access_token, "local");
  }

  if (type === "signup") {
    await logAuthEvent("auth.email_verified", { actorId: data.user.id });
    // PN-1 : compte vérifié → redirigé vers la connexion.
    return redirectTo("/connexion?motif=email-verifie");
  }

  if (type === "invite") {
    // E-33 : l'invitation confirme l'adresse du coach ; il définit ensuite
    // son mot de passe par le même parcours sécurisé que la
    // réinitialisation (cookie signé httpOnly, aucune session — C1).
    await logAuthEvent("auth.invitation_acceptee", { actorId: data.user.id });
    const response = redirectTo("/reinitialisation?contexte=invitation");
    const cookie = buildResetCookie(data.user.id);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  }

  // type=recovery : preuve de contrôle de l'e-mail acquise — on ouvre une
  // fenêtre courte de saisie du nouveau mot de passe via un jeton signé
  // httpOnly (aucune session Supabase, gating C1).
  const response = redirectTo("/reinitialisation");
  const cookie = buildResetCookie(data.user.id);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
