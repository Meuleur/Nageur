import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { metriquesAdminSchema, type MetriquesAdmin } from "@/features/admin/metriques";
import type { FournisseurAdmin } from "@/features/admin/schemas";

/**
 * Couche d'accès admin (D2, C4) — toutes les lectures/écritures passent par
 * le service role : la RLS n'ouvre AUCUNE écriture d'administration côté
 * client (RG-12, RG-38), et les server actions revérifient le rôle
 * super_admin avant chaque appel (RG-40). ADR-020 : aucune fonction ici ne
 * lit le contenu des séances ni les auto-évaluations.
 */

export class AdminDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDataError";
  }
}

// ---------------------------------------------------------------------------
// E-30 — Métriques (RG-39).
// ---------------------------------------------------------------------------

export async function lireMetriquesAdmin(depuis: Date | null): Promise<MetriquesAdmin> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("admin_metrics", {
    p_depuis: depuis ? depuis.toISOString() : null,
  });

  if (error) {
    console.error("admin: lecture des métriques impossible");
    throw new AdminDataError("métriques illisibles");
  }
  return metriquesAdminSchema.parse(data);
}

// ---------------------------------------------------------------------------
// E-31 — Fournisseurs LLM (RG-38, ADR-007).
// ---------------------------------------------------------------------------

export type FournisseurLlmAdmin = {
  fournisseur: FournisseurAdmin;
  modele: string | null;
  actif: boolean;
  /** Présence d'une clé UNIQUEMENT (jamais la clé ni son chiffré, ADR-007). */
  cleEnregistree: boolean;
  majLe: string;
};

export async function listerFournisseursLlm(): Promise<FournisseurLlmAdmin[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("llm_providers")
    .select("fournisseur, modele, is_active, api_key_encrypted, updated_at")
    .order("fournisseur", { ascending: true });

  if (error || !data) {
    console.error("admin: lecture des fournisseurs impossible");
    throw new AdminDataError("fournisseurs illisibles");
  }
  return data.map((ligne) => ({
    fournisseur: ligne.fournisseur as FournisseurAdmin,
    modele: ligne.modele,
    actif: ligne.is_active,
    cleEnregistree: Boolean(ligne.api_key_encrypted),
    majLe: ligne.updated_at,
  }));
}

export async function definirCleApiLlm(
  fournisseur: FournisseurAdmin,
  cle: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("set_llm_api_key", {
    p_fournisseur: fournisseur,
    p_cle: cle,
  });
  if (error) {
    // Jamais le message SQL (il pourrait citer des valeurs) ni la clé.
    console.error("admin: enregistrement de la clé refusé");
    throw new AdminDataError("clé non enregistrée");
  }
}

export async function definirModeleLlm(
  fournisseur: FournisseurAdmin,
  modele: string,
  actorId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("set_llm_model", {
    p_fournisseur: fournisseur,
    p_modele: modele,
    p_actor: actorId,
  });
  if (error) {
    console.error("admin: choix du modèle refusé");
    throw new AdminDataError("modèle non enregistré");
  }
}

export async function activerFournisseurLlm(
  fournisseur: FournisseurAdmin,
  actorId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("set_active_llm_provider", {
    p_fournisseur: fournisseur,
    p_actor: actorId,
  });
  if (error) {
    console.error("admin: activation du fournisseur refusée");
    throw new AdminDataError("fournisseur non activé");
  }
}

// ---------------------------------------------------------------------------
// E-32 — Affectations (RG-10 à RG-15).
// ---------------------------------------------------------------------------

export type NageurAffectation = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  coachId: string | null;
};

export type CoachAdmin = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  creeLe: string;
};

export async function listerNageursPourAffectation(): Promise<NageurAffectation[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom, email, coach_id")
    .eq("role", "nageur")
    .order("prenom", { ascending: true })
    .order("nom", { ascending: true });

  if (error || !data) {
    console.error("admin: lecture des nageurs impossible");
    throw new AdminDataError("nageurs illisibles");
  }
  return data.map((ligne) => ({
    id: ligne.id,
    prenom: ligne.prenom,
    nom: ligne.nom,
    email: ligne.email,
    coachId: ligne.coach_id,
  }));
}

export async function listerCoachs(): Promise<CoachAdmin[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom, email, created_at")
    .eq("role", "coach")
    .order("prenom", { ascending: true })
    .order("nom", { ascending: true });

  if (error || !data) {
    console.error("admin: lecture des coachs impossible");
    throw new AdminDataError("coachs illisibles");
  }
  return data.map((ligne) => ({
    id: ligne.id,
    prenom: ligne.prenom,
    nom: ligne.nom,
    email: ligne.email,
    creeLe: ligne.created_at,
  }));
}

export async function affecterCoach(affectation: {
  nageurId: string;
  coachId: string | null;
  actorId: string;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("set_coach_assignment", {
    p_nageur_id: affectation.nageurId,
    p_coach_id: affectation.coachId,
    p_actor: affectation.actorId,
  });
  if (error) {
    console.error("admin: affectation refusée");
    throw new AdminDataError("affectation refusée");
  }
}

// ---------------------------------------------------------------------------
// E-33 — Comptes coachs par invitation (RG-02, C4).
// ---------------------------------------------------------------------------

export type CreationCoach =
  | { ok: true; coachId: string; tokenHash: string; relance: boolean }
  | { ok: false; code: "email_deja_utilise" | "echec" };

/**
 * Crée le compte coach côté serveur (RG-02) puis génère le jeton
 * d'invitation que NOTRE e-mail transporte (lien /auth/confirm?type=invite).
 * Aucun mot de passe ne transite : le coach le définira lui-même (C4).
 *
 * Le profil applicatif est inséré EXPLICITEMENT avec le rôle coach — c'est
 * le chemin prévu par CH2 pour les comptes créés par l'outillage : sans
 * métadonnées prenom/nom, handle_new_user ne crée pas de profil. (Vérifié
 * empiriquement : GoTrue fusionne app_metadata APRÈS l'insertion, le
 * trigger ne voit donc jamais le rôle à la création — on ne s'y fie pas.)
 * Toute étape qui échoue déclenche le retour arrière : aucun compte orphelin.
 */
export async function creerCoachInvite(invitation: {
  prenom: string;
  nom: string;
  email: string;
}): Promise<CreationCoach> {
  const service = createServiceRoleClient();

  const { data: cree, error: erreurCreation } = await service.auth.admin.createUser({
    email: invitation.email,
    email_confirm: false,
    // Cohérence avec le seed et la défense en profondeur — la source de
    // vérité applicative reste profiles.role, inséré ci-dessous.
    app_metadata: { role: "coach" },
  });

  if (erreurCreation || !cree.user) {
    if (erreurCreation?.code === "email_exists") {
      // Lien expiré avant activation ? On RE-INVITE un coach jamais activé
      // plutôt que de laisser le compte en impasse ; toute autre collision
      // (compte actif, autre rôle) reste une erreur explicite.
      return reinviterCoachNonActive(invitation);
    }
    console.error("admin: création du compte coach refusée");
    return { ok: false, code: "echec" };
  }

  const { error: erreurProfil } = await service.from("profiles").insert({
    id: cree.user.id,
    role: "coach",
    prenom: invitation.prenom,
    nom: invitation.nom,
    email: invitation.email,
  });

  if (erreurProfil) {
    await service.auth.admin.deleteUser(cree.user.id);
    console.error("admin: création du profil coach refusée");
    return { ok: false, code: "echec" };
  }

  const { data: lien, error: erreurLien } = await service.auth.admin.generateLink({
    type: "invite",
    email: invitation.email,
  });

  if (erreurLien || !lien.properties?.hashed_token) {
    // Pas de lien = pas d'invitation : on ne laisse pas un compte orphelin
    // (la suppression auth.users cascade sur le profil).
    await service.auth.admin.deleteUser(cree.user.id);
    console.error("admin: génération du lien d'invitation impossible");
    return { ok: false, code: "echec" };
  }

  return { ok: true, coachId: cree.user.id, tokenHash: lien.properties.hashed_token, relance: false };
}

/**
 * Adresse déjà connue : si (et seulement si) elle correspond à un coach qui
 * n'a JAMAIS activé son compte (e-mail non confirmé), on régénère un lien
 * d'invitation — et on rafraîchit prénom/nom, l'admin corrige souvent une
 * coquille en relançant. Tout autre cas → email_deja_utilise.
 */
async function reinviterCoachNonActive(invitation: {
  prenom: string;
  nom: string;
  email: string;
}): Promise<CreationCoach> {
  const service = createServiceRoleClient();

  const { data: profil } = await service
    .from("profiles")
    .select("id, role")
    .eq("email", invitation.email)
    .maybeSingle();
  if (!profil || profil.role !== "coach") {
    return { ok: false, code: "email_deja_utilise" };
  }

  const { data: compte, error: erreurCompte } = await service.auth.admin.getUserById(profil.id);
  if (erreurCompte || !compte.user || compte.user.email_confirmed_at) {
    return { ok: false, code: "email_deja_utilise" };
  }

  const { error: erreurProfil } = await service
    .from("profiles")
    .update({ prenom: invitation.prenom, nom: invitation.nom })
    .eq("id", profil.id);
  if (erreurProfil) {
    console.error("admin: mise à jour du profil coach invité impossible");
    return { ok: false, code: "echec" };
  }

  const { data: lien, error: erreurLien } = await service.auth.admin.generateLink({
    type: "invite",
    email: invitation.email,
  });
  if (erreurLien || !lien.properties?.hashed_token) {
    console.error("admin: régénération du lien d'invitation impossible");
    return { ok: false, code: "echec" };
  }

  return { ok: true, coachId: profil.id, tokenHash: lien.properties.hashed_token, relance: true };
}

/** L'invitation a échoué après création (e-mail non parti) : retour arrière. */
export async function supprimerCoachInvite(coachId: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.auth.admin.deleteUser(coachId);
  if (error) {
    console.error("admin: suppression du compte coach orphelin impossible");
  }
}

// ---------------------------------------------------------------------------
// Journal des actions d'administration (C1/E2) — best effort, comme les
// autres modules d'audit : un échec n'interrompt jamais le parcours.
// Identifiants pseudonymes uniquement, jamais de clé ni d'adresse e-mail.
// ---------------------------------------------------------------------------

export async function journaliserEvenementAdmin(
  eventType: string,
  actorId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("audit_log").insert({
      event_type: eventType,
      actor_id: actorId,
      metadata,
    });
    if (error) {
      console.error(`audit_log: écriture impossible (${eventType})`);
    }
  } catch {
    console.error(`audit_log: écriture impossible (${eventType})`);
  }
}
