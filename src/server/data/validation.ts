import "server-only";

import type { StatutSeance } from "@/features/seances/statuts";
import type { ModificationSeance } from "@/features/validation/schemas";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Couche d'accès (D2) — transitions de statut d'une séance par le coach
 * (T2/T3/T4) via traiter_seance (SECURITY DEFINER, EXECUTE service_role
 * uniquement) : revérification de la relation coach↔nageur (RG-25), statut
 * en_attente requis (RG-30), commentaire obligatoire au refus (RG-29) et,
 * pour T3, remplacement du contenu + recalcul de la distance totale — le
 * tout dans une seule transaction (A3).
 */

export type CodeErreurTraitement =
  | "introuvable"
  | "acces_refuse"
  | "deja_traitee"
  | "commentaire_requis"
  | "echec";

/**
 * Messages utilisateur (B2). « introuvable » et « acces_refuse » partagent
 * volontairement le même texte : ne pas révéler l'existence d'une séance
 * d'un nageur non affecté (RG-43).
 */
const MESSAGES: Record<CodeErreurTraitement, string> = {
  introuvable: "Cette séance n'existe pas ou ne vous est pas accessible.",
  acces_refuse: "Cette séance n'existe pas ou ne vous est pas accessible.",
  deja_traitee: "Cette séance a déjà été traitée — son statut est définitif.",
  commentaire_requis: "Le commentaire est obligatoire pour refuser une séance.",
  echec: "Le traitement de la séance a échoué. Réessayez dans quelques instants.",
};

export class TraitementSeanceError extends Error {
  readonly code: CodeErreurTraitement;

  constructor(code: CodeErreurTraitement) {
    super(MESSAGES[code]);
    this.name = "TraitementSeanceError";
    this.code = code;
  }
}

export type TransitionSeance = {
  seanceId: string;
  /** Utilisateur connecté — la fonction SQL revérifie qu'il est LE coach affecté. */
  coachId: string;
  statutCible: Exclude<StatutSeance, "en_attente">;
  commentaire: string | null;
  /** Contenu complet de remplacement — requis pour statutCible = modifiee (T3). */
  modification?: Pick<ModificationSeance, "echauffement" | "series" | "retour_au_calme">;
};

export async function traiterSeance(transition: TransitionSeance): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.rpc("traiter_seance", {
    p_seance_id: transition.seanceId,
    p_coach_id: transition.coachId,
    p_statut_cible: transition.statutCible,
    p_commentaire: transition.commentaire,
    p_modification: transition.modification
      ? {
          echauffement: transition.modification.echauffement,
          series: transition.modification.series.map((serie) => ({
            repetitions: serie.repetitions,
            distance_m: serie.distance_m,
            type_nage: serie.type_nage,
            recuperation_s: serie.recuperation_s,
            consigne: serie.consigne ? serie.consigne : null,
          })),
          retour_au_calme: transition.modification.retour_au_calme,
        }
      : null,
  });

  if (error) {
    // Garde-fous SQL (course possible entre lecture des préconditions et écriture).
    if (error.message.includes("seance inconnue")) {
      throw new TraitementSeanceError("introuvable");
    }
    if (error.message.includes("RG-25")) {
      throw new TraitementSeanceError("acces_refuse");
    }
    if (error.message.includes("RG-30")) {
      throw new TraitementSeanceError("deja_traitee");
    }
    if (error.message.includes("RG-29")) {
      throw new TraitementSeanceError("commentaire_requis");
    }
    console.error("validation: traitement de la séance refusé");
    throw new TraitementSeanceError("echec");
  }
}
