import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, UserRound } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Accueil — App Natation" };

/**
 * E-10 minimal (CH2) : cible de redirection du rôle nageur après
 * authentification complète, avec l'état « sans coach » (RG-14, ADR-014).
 * L'accueil complet arrive avec les chantiers suivants (profil CH3,
 * génération CH4).
 */
export default async function AccueilPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom")
    .eq("id", user.id)
    .single();
  // Vue dédiée my_coach (ADR-024) : prénom + nom du coach affecté, ou vide.
  const { data: coach } = await supabase.from("my_coach").select("prenom, nom").maybeSingle();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">
            Bonjour {profile?.prenom ?? ""}
          </h1>
          <p className="text-caption text-muted-foreground">Votre espace nageur</p>
        </div>
        <LogoutButton />
      </header>

      {coach ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" aria-hidden />
              Votre coach&nbsp;: {coach.prenom} {coach.nom}
            </CardTitle>
            <CardDescription>
              Vos séances seront relues et validées par votre coach avant d&apos;être utilisables.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Vous n&apos;avez pas encore de coach</CardTitle>
            <CardDescription>
              Un administrateur doit vous affecter un coach avant que vous puissiez générer des
              séances (RG-14). Vous serez prévenu dès que ce sera fait.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <AlertDescription>
                En attendant, vous pourrez bientôt renseigner votre profil sportif — cette partie
                arrive dans un prochain chantier.
              </AlertDescription>
            </Alert>
            <Button disabled title="Indisponible sans coach affecté">
              <Sparkles aria-hidden />
              Générer ma séance
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-caption text-muted-foreground">
        Écran d&apos;accueil minimal livré avec le chantier CH2 (authentification) — l&apos;accueil
        complet (E-10) arrive avec les chantiers suivants.
      </p>
    </main>
  );
}
