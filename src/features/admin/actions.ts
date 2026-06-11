"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import {
  activerFournisseurLlm,
  affecterCoach,
  creerCoachInvite,
  definirCleApiLlm,
  definirModeleLlm,
  journaliserEvenementAdmin,
  supprimerCoachInvite,
} from "@/server/data/admin";
import { sendMail } from "@/server/email";
import { buildInvitationCoachEmail } from "@/server/email/invitation-email";
import { getAppUrl } from "@/server/env";
import { testerCleLlm } from "@/server/llm";
import { notifierNageurCoachAffecte } from "@/server/notifications";

import type { AdminFormState } from "./form-state";
import { exigerSuperAdmin } from "./garde";
import {
  activationSchema,
  affectationSchema,
  cleApiSchema,
  invitationCoachSchema,
  modeleSchema,
} from "./schemas";

/**
 * Actions serveur de l'espace admin (E-31 à E-33, C4). Toutes les opérations
 * sensibles vivent ici : revalidation Zod (D2), garde de rôle (RG-40), puis
 * fonctions service role. Aucune clé n'est journalisée ni renvoyée (ADR-007).
 */

const ERREUR_GENERIQUE = "L'opération a échoué. Réessayez dans quelques instants.";

function fieldErrors(error: z.ZodError): AdminFormState {
  return { status: "error", fieldErrors: z.flattenError(error).fieldErrors };
}

// ---------------------------------------------------------------------------
// E-31 — Fournisseurs LLM (RG-38, ADR-007).
// ---------------------------------------------------------------------------

export async function definirCleApiAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await exigerSuperAdmin();

  const parsed = cleApiSchema.safeParse({
    fournisseur: formData.get("fournisseur"),
    cle: formData.get("cle"),
  });
  if (!parsed.success) {
    return fieldErrors(parsed.error);
  }

  try {
    // set_llm_api_key chiffre via Vault et journalise la rotation (ADR-007).
    await definirCleApiLlm(parsed.data.fournisseur, parsed.data.cle);
  } catch {
    return { status: "error", message: ERREUR_GENERIQUE };
  }

  revalidatePath("/admin/fournisseurs");
  return {
    status: "success",
    message: "Clé enregistrée et chiffrée. Elle ne sera plus jamais affichée.",
  };
}

export async function testerCleAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const adminId = await exigerSuperAdmin();

  const parsed = activationSchema.safeParse({ fournisseur: formData.get("fournisseur") });
  if (!parsed.success) {
    return { status: "error", message: ERREUR_GENERIQUE };
  }

  const resultat = await testerCleLlm(parsed.data.fournisseur);
  await journaliserEvenementAdmin("llm.cle_testee", adminId, {
    fournisseur: parsed.data.fournisseur,
    resultat: resultat.ok ? "ok" : resultat.code,
  });

  if (resultat.ok) {
    return { status: "success", message: "Clé valide : le fournisseur a répondu." };
  }
  const messages = {
    cle_absente: "Aucune clé enregistrée pour ce fournisseur : enregistrez-en une d'abord.",
    cle_invalide: "La clé enregistrée est invalide ou révoquée. Enregistrez une nouvelle clé.",
    fournisseur_injoignable:
      "Fournisseur injoignable — la clé n'a pas pu être vérifiée. Réessayez.",
  } as const;
  return { status: "error", message: messages[resultat.code] };
}

export async function definirModeleAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const adminId = await exigerSuperAdmin();

  const parsed = modeleSchema.safeParse({
    fournisseur: formData.get("fournisseur"),
    modele: formData.get("modele"),
  });
  if (!parsed.success) {
    return fieldErrors(parsed.error);
  }

  try {
    await definirModeleLlm(parsed.data.fournisseur, parsed.data.modele, adminId);
  } catch {
    return { status: "error", message: ERREUR_GENERIQUE };
  }

  revalidatePath("/admin/fournisseurs");
  return { status: "success", message: "Modèle enregistré." };
}

export async function activerFournisseurAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const adminId = await exigerSuperAdmin();

  const parsed = activationSchema.safeParse({ fournisseur: formData.get("fournisseur") });
  if (!parsed.success) {
    return { status: "error", message: ERREUR_GENERIQUE };
  }

  try {
    // RG-38 : la fonction SQL désactive l'autre fournisseur dans la même
    // transaction — un seul actif, garanti par l'index partiel.
    await activerFournisseurLlm(parsed.data.fournisseur, adminId);
  } catch {
    return { status: "error", message: ERREUR_GENERIQUE };
  }

  revalidatePath("/admin/fournisseurs");
  return { status: "success", message: "Fournisseur actif mis à jour." };
}

// ---------------------------------------------------------------------------
// E-32 — Affectations coach ↔ nageur (RG-10 à RG-15, PA-4).
// ---------------------------------------------------------------------------

export async function affecterCoachAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const adminId = await exigerSuperAdmin();

  const parsed = affectationSchema.safeParse({
    nageurId: formData.get("nageur_id"),
    coachId: formData.get("coach_id"),
  });
  if (!parsed.success) {
    return { status: "error", message: ERREUR_GENERIQUE };
  }
  const { nageurId, coachId } = parsed.data;

  try {
    // set_coach_assignment revérifie les rôles au plus près des données
    // (RG-12) ; RG-15 : les séances existantes ne sont pas touchées.
    await affecterCoach({ nageurId, coachId, actorId: adminId });
  } catch {
    return { status: "error", message: ERREUR_GENERIQUE };
  }

  if (coachId !== null) {
    // N8 (CH7, PA-4) : nageur notifié hors chemin critique — l'affectation
    // reste acquise même si l'e-mail échoue, la fonction ne rejette jamais.
    after(() => notifierNageurCoachAffecte(nageurId));
  }

  revalidatePath("/admin/affectations");
  revalidatePath("/admin");
  return {
    status: "success",
    message:
      coachId === null
        ? "Nageur désaffecté : il ne peut plus générer de séance (RG-14)."
        : "Affectation enregistrée : la génération est débloquée pour ce nageur.",
  };
}

// ---------------------------------------------------------------------------
// E-33 — Invitation d'un coach (RG-02, PA-5).
// ---------------------------------------------------------------------------

export async function inviterCoachAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const adminId = await exigerSuperAdmin();

  const parsed = invitationCoachSchema.safeParse({
    prenom: formData.get("prenom"),
    nom: formData.get("nom"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return fieldErrors(parsed.error);
  }

  const creation = await creerCoachInvite(parsed.data);
  if (!creation.ok) {
    if (creation.code === "email_deja_utilise") {
      return {
        status: "error",
        fieldErrors: { email: ["Un compte actif existe déjà avec cette adresse."] },
      };
    }
    return { status: "error", message: ERREUR_GENERIQUE };
  }

  try {
    await sendMail(
      buildInvitationCoachEmail({
        to: parsed.data.email,
        prenom: parsed.data.prenom,
        appUrl: getAppUrl(),
        tokenHash: creation.tokenHash,
      }),
    );
  } catch {
    // E-mail non parti = pas d'invitation : retour arrière sur un compte
    // fraîchement créé (jamais sur une relance — le compte préexistait).
    if (!creation.relance) {
      await supprimerCoachInvite(creation.coachId);
    }
    return {
      status: "error",
      message: "L'e-mail d'invitation n'est pas parti — aucune invitation créée. Réessayez.",
    };
  }

  await journaliserEvenementAdmin("coach.invitation_envoyee", adminId, {
    coach_id: creation.coachId,
    relance: creation.relance,
  });

  revalidatePath("/admin/coachs");
  return {
    status: "success",
    message: creation.relance
      ? `Nouvelle invitation envoyée à ${parsed.data.email}.`
      : `Invitation envoyée à ${parsed.data.email} — le compte sera actif dès que le coach aura défini son mot de passe.`,
  };
}
