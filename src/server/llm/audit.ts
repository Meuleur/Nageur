import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

import type { EvenementLlm } from "./generation";

/**
 * Journal des échecs de génération (C2/RG-23, E1 audit_log) — au mieux
 * (best effort), comme src/server/auth/audit.ts : un échec d'audit ne casse
 * jamais le parcours. INTERDIT dans metadata : clé API, contenu de prompt
 * ou de séance, nom, e-mail (E2). actor_id = uuid du nageur (pseudonyme,
 * prévu par E1) ; les codes quota/clé/configuration portent alerte_admin
 * pour le dashboard C4 (CH8).
 */
export async function journaliserEvenementLlm(evenement: EvenementLlm): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const alerteAdmin =
      evenement.metadata.code === "quota_depasse" ||
      evenement.metadata.code === "cle_invalide" ||
      evenement.metadata.code === "configuration_manquante";
    const { error } = await supabase.from("audit_log").insert({
      event_type: evenement.type,
      actor_id: evenement.nageurId,
      metadata: { ...evenement.metadata, alerte_admin: alerteAdmin },
    });
    if (error) {
      console.error(`audit_log: écriture impossible (${evenement.type})`);
    }
  } catch {
    console.error(`audit_log: écriture impossible (${evenement.type})`);
  }
}
