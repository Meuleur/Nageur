import "server-only";

import { redirect } from "next/navigation";

import { ROLE_HOME, type AppRole } from "@/features/auth/routes";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * RG-40 / défense en profondeur : le proxy ne protège que les routes — les
 * pages admin lisent en service role et les server actions restent des
 * points d'entrée HTTP. Pages ET actions revérifient donc la session puis
 * le rôle super_admin (profil lu sous RLS). Renvoie l'id de l'admin.
 */
export async function exigerSuperAdmin(): Promise<string> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile?.role ?? null) as AppRole | null;
  if (role !== "super_admin") {
    redirect(role ? ROLE_HOME[role] : "/connexion");
  }
  return user.id;
}
