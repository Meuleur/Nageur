"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSessionClient } from "@/lib/supabase/session";
import { genererSeance, GenerationSeanceError } from "@/server/llm";

import type { GenerationFormState } from "./form-state";

/**
 * Action serveur E-12 (PN-5, RG-19) : déclenche la génération CH4
 * (`genererSeance`) pour le nageur connecté. Le client ne fait que déclencher
 * — préconditions (RG-14/RG-17), appel fournisseur, validation et écriture
 * de la séance restent côté serveur (service role, RG-21).
 */
// Signature réduite : useActionState fournit (état précédent, FormData),
// inutiles ici — le nageur connecté est la seule entrée (RG-19).
export async function genererSeanceAction(): Promise<GenerationFormState> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Session absente ou expirée : retour à la connexion (RG-08).
    redirect("/connexion");
  }

  try {
    await genererSeance(user.id);
  } catch (error) {
    if (error instanceof GenerationSeanceError) {
      // RG-23 : aucune séance créée ; message utilisateur + relance (RG-24).
      return {
        status: "error",
        message: error.message,
        relancePossible: error.relancePossible,
        code: error.code,
      };
    }
    return {
      status: "error",
      message: "La génération a échoué. Réessayez dans quelques instants.",
      relancePossible: true,
    };
  }

  // CH7 (RG-36) : point d'appel de la notification e-mail du coach — la
  // séance vient d'être créée en_attente (T1) ; branchement prévu en CH7.

  // PN-5 : succès → message « envoyée à votre coach » porté par E-13.
  revalidatePath("/seances");
  redirect("/seances?generation=envoyee");
}
