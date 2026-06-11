import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

import type { EvenementNotification } from "./notification";

/**
 * Journal des envois de notification (ADR-020, E1 audit_log) — au mieux
 * (best effort), comme src/server/llm/audit.ts : un échec d'audit ne casse
 * jamais le parcours. INTERDIT dans metadata : adresse e-mail, objet ou
 * contenu du message, nom (E2). Seuls voyagent le type de notification
 * (N4–N8), des identifiants pseudonymes (uuid de séance/profil), le nombre
 * de tentatives et le motif d'échec. actor_id reste nul : l'envoi est un
 * acte du système, pas d'un utilisateur.
 */
export async function journaliserEvenementNotification(
  evenement: EvenementNotification,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("audit_log").insert({
      event_type: evenement.type,
      actor_id: null,
      metadata: evenement.metadata,
    });
    if (error) {
      console.error(`audit_log: écriture impossible (${evenement.type})`);
    }
  } catch {
    console.error(`audit_log: écriture impossible (${evenement.type})`);
  }
}
