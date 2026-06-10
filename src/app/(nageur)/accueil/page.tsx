import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, ListChecks, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Accueil — App Natation" };

/**
 * E-10 — Accueil nageur (PN-3) : coach affiché via la vue `my_coach`
 * uniquement (prénom + nom, jamais l'e-mail — ADR-024) et accès rapides.
 * Sans coach (RG-13/RG-14, ADR-014) : bandeau dédié, génération indisponible,
 * profil accessible. Le bouton de génération sera branché en CH4/CH5 —
 * emplacement prévu, désactivé pour l'instant.
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

  const [{ data: profile }, { data: coach }, { data: profilSportif }] = await Promise.all([
    supabase.from("profiles").select("prenom").eq("id", user.id).single(),
    // Vue dédiée my_coach (ADR-024) : prénom + nom du coach affecté, ou vide.
    supabase.from("my_coach").select("prenom, nom").maybeSingle(),
    supabase.from("swimmer_profiles").select("nageur_id").eq("nageur_id", user.id).maybeSingle(),
  ]);

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
              séances. En attendant, vous pouvez déjà renseigner votre profil sportif — il servira
              dès que votre coach sera là.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <section aria-label="Accès rapides" className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-5 text-primary" aria-hidden />
              Mon profil
            </CardTitle>
            <CardDescription>
              Niveau, objectifs, disponibilités — la base de vos futures séances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/profil">
                {profilSportif ? "Modifier mon profil" : "Renseigner mon profil"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-5 text-primary" aria-hidden />
              Générer une séance
            </CardTitle>
            <CardDescription>
              {coach
                ? "Bientôt disponible : une séance proposée par l'IA, validée par votre coach."
                : "Indisponible tant qu'aucun coach ne vous est affecté."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled
              className="w-full"
              title={coach ? "Disponible prochainement" : "Indisponible sans coach affecté"}
            >
              Générer ma séance
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-5 text-primary" aria-hidden />
              Mes séances
            </CardTitle>
            <CardDescription>
              Bientôt disponible : retrouvez ici vos séances et leur statut.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline" className="w-full" title="Disponible prochainement">
              Voir mes séances
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
