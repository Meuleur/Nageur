import "server-only";

import type { Materiel, Niveau, Objectif } from "@/features/profil/schemas";
import { createServiceRoleClient } from "@/lib/supabase/server";

import type { ContexteNageur } from "@/server/llm/generation";

/**
 * Couche d'accès (D2) — contexte nécessaire à la génération : coach affecté
 * (RG-14) et profil sportif (RG-17), lus en service role avec contrôles
 * applicatifs (les écritures de génération n'ont pas de policy RLS client).
 */
export async function chargerContexteGeneration(nageurId: string): Promise<ContexteNageur> {
  const supabase = createServiceRoleClient();

  const { data: profilApplicatif, error: erreurProfil } = await supabase
    .from("profiles")
    .select("coach_id, role")
    .eq("id", nageurId)
    .eq("role", "nageur")
    .maybeSingle();

  if (erreurProfil || !profilApplicatif) {
    throw new Error(`profil applicatif introuvable pour le nageur ${nageurId}`);
  }

  const { data: profilSportif, error: erreurSportif } = await supabase
    .from("swimmer_profiles")
    .select("niveau, frequence, duree, bassin, objectifs, materiel")
    .eq("nageur_id", nageurId)
    .maybeSingle();

  if (erreurSportif) {
    throw new Error(`profil sportif illisible pour le nageur ${nageurId}`);
  }

  return {
    coachId: profilApplicatif.coach_id,
    profil: profilSportif
      ? {
          niveau: profilSportif.niveau as Niveau,
          frequence: profilSportif.frequence,
          duree: profilSportif.duree,
          bassin: profilSportif.bassin,
          objectifs: profilSportif.objectifs as Objectif[],
          materiel: (profilSportif.materiel ?? []) as Materiel[],
        }
      : null,
  };
}
