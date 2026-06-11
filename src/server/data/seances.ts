import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

import { GenerationSeanceError } from "@/server/llm/errors";
import type { SeanceAPersister } from "@/server/llm/generation";

/**
 * Persistance d'une séance générée (RG-21) via insert_generated_seance
 * (SECURITY DEFINER, EXECUTE service_role uniquement) : séance en_attente +
 * séries en une transaction — aucune séance partielle (C2). La fonction SQL
 * re-vérifie RG-14/RG-17 et dérive le coach au moment de la génération (E1).
 */
export async function insererSeanceGeneree(aPersister: SeanceAPersister): Promise<string> {
  const supabase = createServiceRoleClient();
  const { seance } = aPersister;

  const { data, error } = await supabase.rpc("insert_generated_seance", {
    p_nageur_id: aPersister.nageurId,
    p_echauffement_distance_m: seance.echauffement.distance_m,
    p_echauffement_consignes: seance.echauffement.consignes,
    p_retour_calme_distance_m: seance.retour_au_calme.distance_m,
    p_retour_calme_consignes: seance.retour_au_calme.consignes,
    p_distance_totale_m: seance.distance_totale_m,
    p_duree_estimee_min: seance.duree_estimee_min,
    p_fournisseur: aPersister.fournisseur,
    p_tokens: aPersister.tokens,
    p_series: seance.corps.map((serie) => ({
      repetitions: serie.repetitions,
      distance_m: serie.distance_m,
      type_nage: serie.type_nage,
      recuperation_s: serie.recuperation_s,
      consigne: serie.consigne ? serie.consigne : null,
    })),
  });

  if (error || typeof data !== "string") {
    // Garde-fous SQL (course possible entre préconditions et écriture).
    if (error?.message.includes("RG-14")) {
      throw new GenerationSeanceError("nageur_sans_coach");
    }
    if (error?.message.includes("RG-17")) {
      throw new GenerationSeanceError("profil_incomplet");
    }
    console.error("seances: insertion de la séance générée refusée");
    throw new GenerationSeanceError("persistance_echouee");
  }

  return data;
}
