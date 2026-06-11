import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Journal des événements sensibles (C1/E1/D3) — au mieux (best effort) :
 * un échec d'audit ne casse jamais le parcours utilisateur.
 *
 * INTERDIT dans metadata : e-mail, nom, mot de passe, code OTP, jeton, IP en
 * clair (E2). actor_id (uuid, pseudonyme) est prévu par le schéma E1.
 */
export type AuthAuditEvent =
  | "auth.signup"
  | "auth.email_verified"
  | "auth.login_failed"
  | "auth.login_locked"
  | "auth.login_password_ok"
  | "auth.otp_failed"
  | "auth.otp_resent"
  | "auth.otp_verified"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "auth.invitation_acceptee"
  | "auth.logout"
  | "auth.rate_limited";

export async function logAuthEvent(
  event: AuthAuditEvent,
  options: {
    actorId?: string | null;
    metadata?: Record<string, string | number | boolean>;
  } = {},
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("audit_log").insert({
      event_type: event,
      actor_id: options.actorId ?? null,
      metadata: options.metadata ?? {},
    });
    if (error) {
      console.error(`audit_log: écriture impossible (${event})`);
    }
  } catch {
    console.error(`audit_log: écriture impossible (${event})`);
  }
}
