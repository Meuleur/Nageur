"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { createSessionClient } from "@/lib/supabase/session";
import { consumeRateLimit, RATE_LIMITS } from "@/server/auth/rate-limit";
import { genererSeance, GenerationSeanceError, journaliserGenerationLimitee } from "@/server/llm";
import { notifierCoachSeanceEnAttente } from "@/server/notifications";

import type { GenerationFormState } from "./form-state";
import { messageGenerationLimitee } from "./garde-fou";

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

  // ADR-027 : garde-fou de sécurité anti-emballement, sur l'infrastructure
  // de rate limiting C1. Le seuil est large — l'usage normal ne l'atteint
  // jamais (RG-24) ; un compteur indisponible refuse la génération (une
  // mesure de sécurité ne se contourne pas silencieusement).
  try {
    const garde = await consumeRateLimit(
      "generation:nageur",
      user.id,
      RATE_LIMITS.generationByUser,
    );
    if (!garde.allowed) {
      await journaliserGenerationLimitee(user.id, garde.retryAfterSeconds);
      return { status: "error", message: messageGenerationLimitee(garde.retryAfterSeconds) };
    }
  } catch {
    return {
      status: "error",
      message: "La génération a échoué. Réessayez dans quelques instants.",
      relancePossible: true,
    };
  }

  let seanceId: string;
  try {
    ({ seanceId } = await genererSeance(user.id));
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

  // N4 (RG-36, ADR-020) : coach notifié hors chemin critique — after()
  // exécute l'envoi après la réponse ; la séance créée en_attente (T1)
  // reste acquise même si l'e-mail échoue, et la fonction ne rejette jamais.
  after(() => notifierCoachSeanceEnAttente(seanceId));

  // PN-5 : succès → message « envoyée à votre coach » porté par E-13.
  revalidatePath("/seances");
  redirect("/seances?generation=envoyee");
}
