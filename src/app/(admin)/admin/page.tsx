import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Administration — App Natation" };

/** E-30 minimal (CH2) : cible de redirection du rôle super admin (RG-03). */
export default async function AdminPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">
            Bonjour {profile?.prenom ?? ""}
          </h1>
          <p className="text-caption text-muted-foreground">Espace super admin</p>
        </div>
        <LogoutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Administration</CardTitle>
          <CardDescription>
            Les métriques, la gestion des fournisseurs LLM et les affectations coach ↔ nageur (E-30
            à E-33) arrivent avec un prochain chantier. Cet écran confirme simplement votre
            authentification et votre rôle.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
