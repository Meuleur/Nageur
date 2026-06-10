"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSessionClient } from "@/lib/supabase/session";

import { diffCreneaux } from "./creneaux";
import type { ProfilFormState } from "./form-state";
import { parseProfilFormData, profilSportifSchema } from "./schemas";

/**
 * Action serveur du profil sportif (E-11, RG-16) — revalidation Zod côté
 * serveur (D2) puis écriture avec le client de l'utilisateur, SOUS RLS (E1) :
 * seules ses propres lignes `swimmer_profiles` / `swimmer_availabilities`
 * sont accessibles, et le trigger E1 garantit le rôle nageur.
 * RG-18 : rien ici ne touche aux séances — la modification du profil ne
 * s'applique qu'aux générations ultérieures (CH4).
 */

const GENERIC_ERROR = "Une erreur est survenue. Votre profil n'a pas été enregistré. Réessayez.";

export async function enregistrerProfilAction(
  _prev: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const parsed = profilSportifSchema.safeParse(parseProfilFormData(formData));
      if (!parsed.success) {
        return {
          status: "error",
          message: "Profil non enregistré : corrigez les champs signalés.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors,
        };
      }
      const { disponibilites, ...profil } = parsed.data;

      // 1–1 avec le profil nageur (E1) : création au premier enregistrement,
      // mise à jour ensuite (RG-16).
      const { error: profilError } = await supabase.from("swimmer_profiles").upsert({
        nageur_id: user.id,
        niveau: profil.niveau,
        frequence: profil.frequence,
        duree: profil.duree,
        bassin: profil.bassin,
        objectifs: profil.objectifs,
        materiel: profil.materiel,
      });
      if (profilError) {
        return { status: "error", message: GENERIC_ERROR };
      }

      // Grille : ajout/retrait par diff avec l'existant — un créneau déjà
      // présent n'est jamais réinséré (unicité nageur_id, jour, moment).
      const { data: existants, error: lectureError } = await supabase
        .from("swimmer_availabilities")
        .select("jour, moment")
        .eq("nageur_id", user.id);
      if (lectureError) {
        return { status: "error", message: GENERIC_ERROR };
      }

      const { aAjouter, aSupprimer } = diffCreneaux(existants ?? [], disponibilites);
      if (aSupprimer.length > 0) {
        // Valeurs sûres : jour et moment sortent du schéma Zod (énums fermées).
        const filtre = aSupprimer
          .map((c) => `and(jour.eq.${c.jour},moment.eq.${c.moment})`)
          .join(",");
        const { error } = await supabase
          .from("swimmer_availabilities")
          .delete()
          .eq("nageur_id", user.id)
          .or(filtre);
        if (error) {
          return { status: "error", message: GENERIC_ERROR };
        }
      }
      if (aAjouter.length > 0) {
        const { error } = await supabase.from("swimmer_availabilities").upsert(
          aAjouter.map((c) => ({ nageur_id: user.id, jour: c.jour, moment: c.moment })),
          // Soumission concurrente : un créneau apparu entre la lecture et
          // l'écriture est ignoré plutôt que de faire échouer l'enregistrement.
          { onConflict: "nageur_id,jour,moment", ignoreDuplicates: true },
        );
        if (error) {
          return { status: "error", message: GENERIC_ERROR };
        }
      }

      revalidatePath("/profil");
      return { status: "success", message: "Profil enregistré." };
    }
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  // Session absente ou expirée : retour à la connexion (RG-08).
  redirect("/connexion");
}
