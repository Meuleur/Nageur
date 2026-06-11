"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { createSessionClient } from "@/lib/supabase/session";
import { traiterSeance, TraitementSeanceError } from "@/server/data/validation";
import { notifierNageurSeanceTraitee } from "@/server/notifications";

import type { ModificationFormState, TraitementFormState } from "./form-state";
import {
  formatErreursModification,
  modificationSeanceSchema,
  parseModificationFormData,
  parseTraitementFormData,
  traitementSchema,
} from "./schemas";
import { STATUT_CIBLE_PAR_DECISION } from "./transitions";

/**
 * Actions serveur du cycle de validation (E-22/E-23, PC-3/PC-4). Le client
 * ne fait que déclencher : revalidation Zod (D2) puis transition via
 * traiter_seance (service role) qui revérifie la relation coach↔nageur
 * (RG-25) et le statut en_attente (RG-30) — voir src/server/data/validation.
 */

const ERREUR_INATTENDUE = "Le traitement de la séance a échoué. Réessayez dans quelques instants.";

/** Succès → retour visuel sur le détail (B2 : confirmation après action). */
function redirigerApresTraitement(seanceId: string, statut: string): never {
  revalidatePath("/coach");
  revalidatePath("/coach/seances");
  revalidatePath(`/coach/seances/${seanceId}`);
  redirect(`/coach/seances/${seanceId}?traitement=${statut}`);
}

/** E-22 — Valider (T2) ou Refuser (T4) selon le bouton soumis (RG-26). */
export async function traiterSeanceAction(
  _prev: TraitementFormState,
  formData: FormData,
): Promise<TraitementFormState> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Session absente ou expirée : retour à la connexion (RG-08).
    redirect("/connexion");
  }

  const parsed = traitementSchema.safeParse(parseTraitementFormData(formData));
  if (!parsed.success) {
    const { commentaire } = z.flattenError(parsed.error).fieldErrors;
    return {
      status: "error",
      message: commentaire?.length
        ? "Séance non traitée : corrigez le commentaire."
        : ERREUR_INATTENDUE,
      fieldErrors: { commentaire },
    };
  }

  const { decision, seanceId, commentaire } = parsed.data;
  const statutCible = STATUT_CIBLE_PAR_DECISION[decision];

  try {
    await traiterSeance({ seanceId, coachId: user.id, statutCible, commentaire });
  } catch (error) {
    if (error instanceof TraitementSeanceError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: ERREUR_INATTENDUE };
  }

  // N5/N7 (RG-37, ADR-020) : nageur notifié hors chemin critique — after()
  // exécute l'envoi après la réponse ; la transition (T2 ou T4) reste
  // acquise même si l'e-mail échoue, et la fonction ne rejette jamais.
  after(() => notifierNageurSeanceTraitee({ seanceId, statut: statutCible }));

  redirigerApresTraitement(seanceId, statutCible);
}

/** E-23 — Modifier puis valider (T3) : contenu remplacé + statut modifiee. */
export async function modifierEtValiderSeanceAction(
  _prev: ModificationFormState,
  formData: FormData,
): Promise<ModificationFormState> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Session absente ou expirée : retour à la connexion (RG-08).
    redirect("/connexion");
  }

  const parsed = modificationSeanceSchema.safeParse(parseModificationFormData(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Séance non modifiée : corrigez les champs signalés.",
      erreurs: formatErreursModification(parsed.error),
    };
  }

  const { seanceId, echauffement, series, retour_au_calme, commentaire } = parsed.data;

  try {
    await traiterSeance({
      seanceId,
      coachId: user.id,
      statutCible: "modifiee",
      commentaire,
      modification: { echauffement, series, retour_au_calme },
    });
  } catch (error) {
    if (error instanceof TraitementSeanceError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: ERREUR_INATTENDUE };
  }

  // N6 (RG-37, ADR-020) : nageur notifié hors chemin critique — after()
  // exécute l'envoi après la réponse ; la transition (T3) reste acquise
  // même si l'e-mail échoue, et la fonction ne rejette jamais.
  after(() => notifierNageurSeanceTraitee({ seanceId, statut: "modifiee" }));

  redirigerApresTraitement(seanceId, "modifiee");
}
