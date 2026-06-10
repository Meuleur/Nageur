import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Espace coach — App Natation" };

/** E-20 minimal (CH2) : cible de redirection du rôle coach (RG-03). */
export default async function CoachPage() {
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
          <p className="text-caption text-muted-foreground">Votre espace coach</p>
        </div>
        <LogoutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tableau de bord coach</CardTitle>
          <CardDescription>
            La file des séances à valider et le suivi de vos nageurs (E-20) arrivent avec un
            prochain chantier. Cet écran confirme simplement votre authentification et votre rôle.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
