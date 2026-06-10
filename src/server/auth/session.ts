import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { createSessionClient } from "@/lib/supabase/session";
import type { AppRole } from "@/features/auth/routes";

/**
 * Établit la session navigateur APRÈS validation du second facteur (C1,
 * étape 4 du gating) : un lien magique est généré côté admin (jamais envoyé
 * par e-mail) et son jeton est consommé immédiatement par le client SSR,
 * qui pose les cookies de session. Le mot de passe n'est jamais rejoué et
 * aucun jeton ne transite par une URL ni par le client.
 */
export async function establishVerifiedSession(email: string): Promise<AppRole> {
  const admin = createServiceRoleClient();

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    throw new Error("session: génération du jeton d'établissement impossible");
  }

  const session = await createSessionClient();
  const { data: verified, error: verifyError } = await session.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError || !verified.user) {
    throw new Error("session: établissement de la session impossible");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", verified.user.id)
    .single();
  if (profileError || !profile) {
    throw new Error("session: profil applicatif introuvable");
  }
  return profile.role as AppRole;
}
