"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { estUtilisable, type StatutSeance } from "@/features/seances/statuts";
import { createSessionClient } from "@/lib/supabase/session";

import type { AutoEvaluationFormState } from "./form-state";
import { autoEvaluationSchema, parseAutoEvaluationFormData } from "./schemas";

/**
 * Action serveur E-15 (PN-9, RG-34) — revalidation Zod côté serveur (D2)
 * puis écriture avec le client de l'utilisateur, SOUS RLS (E1) : seules ses
 * propres auto-évaluations sont accessibles. Une par séance, modifiable
 * (ADR-018) → upsert sur seance_id. Le rattachement à une séance utilisable
 * (validee/modifiee) est le contrôle applicatif prévu par E1.
 */

const GENERIC_ERROR =
  "Une erreur est survenue. Votre auto-évaluation n'a pas été enregistrée. Réessayez.";

export async function enregistrerAutoEvaluationAction(
  _prev: AutoEvaluationFormState,
  formData: FormData,
): Promise<AutoEvaluationFormState> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Session absente ou expirée : retour à la connexion (RG-08).
    redirect("/connexion");
  }

  const parsed = autoEvaluationSchema.safeParse(parseAutoEvaluationFormData(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Auto-évaluation non enregistrée : corrigez les champs signalés.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const { seanceId, ressenti, difficulte, commentaire } = parsed.data;

  // RG-34 : la séance doit appartenir au nageur (RLS) et être utilisable.
  const { data: seance, error: erreurSeance } = await supabase
    .from("seances")
    .select("id, statut")
    .eq("id", seanceId)
    .maybeSingle();
  if (erreurSeance) {
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!seance || !estUtilisable(seance.statut as StatutSeance)) {
    return {
      status: "error",
      message: "Cette séance ne peut pas être auto-évaluée : elle n'est pas utilisable.",
    };
  }

  // Une auto-évaluation par séance, modifiable (ADR-018) : upsert sous RLS.
  const { error: erreurEcriture } = await supabase.from("auto_evaluations").upsert(
    {
      seance_id: seanceId,
      nageur_id: user.id,
      ressenti,
      difficulte,
      commentaire,
    },
    { onConflict: "seance_id" },
  );
  if (erreurEcriture) {
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath(`/seances/${seanceId}`);
  redirect(`/seances/${seanceId}?evaluation=enregistree`);
}
