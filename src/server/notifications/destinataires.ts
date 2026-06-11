import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

import type { SeancePourNotification } from "./notification";

/**
 * Couche d'accès (D2) — résolution des destinataires côté serveur (service
 * role) : l'adresse du coach (N4) ou du nageur (N5–N8) ne transite jamais
 * par le client (ADR-024). Lectures tolérantes : null si introuvable,
 * l'orchestrateur journalise et abandonne (ADR-020).
 */

export async function chargerSeancePourNotification(
  seanceId: string,
): Promise<SeancePourNotification | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("seances")
    .select("nageur_id, coach_id, commentaire_coach")
    .eq("id", seanceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return {
    nageurId: data.nageur_id,
    coachId: data.coach_id,
    commentaireCoach: data.commentaire_coach,
  };
}

/** E-mail d'un profil (coach ou nageur) — colonne profiles.email (E1). */
export async function chargerEmailProfil(profilId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profilId)
    .maybeSingle();

  if (error || !data?.email) {
    return null;
  }
  return data.email;
}
