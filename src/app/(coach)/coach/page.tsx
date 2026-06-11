import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ChevronRight, ClipboardCheck, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatutBadge } from "@/features/seances/components/statut-badge";
import { formatDateSeance } from "@/features/seances/labels";
import type { StatutSeance } from "@/features/seances/statuts";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Espace coach — App Natation" };

type SeanceRecente = {
  id: string;
  statut: StatutSeance;
  generated_at: string;
  nageur: { prenom: string; nom: string } | null;
};

/**
 * E-20 — Tableau de bord coach (PC-2) : nombre de séances en attente, liste
 * des nageurs suivis, dernières séances générées (par date) avec accès
 * rapide. Lectures sous RLS (E1) : seuls les nageurs affectés et leurs
 * séances sont visibles (RG-25, RG-43). État vide : aucun nageur (B2).
 */
export default async function CoachPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const [
    { data: profile },
    { data: nageurs, error: erreurNageurs },
    { count: nbEnAttente },
    { data: seancesRecentes },
  ] = await Promise.all([
    supabase.from("profiles").select("prenom").eq("id", user.id).single(),
    supabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("coach_id", user.id)
      .order("prenom", { ascending: true }),
    supabase
      .from("seances")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente"),
    supabase
      .from("seances")
      .select("id, statut, generated_at, nageur:profiles!seances_nageur_id_fkey(prenom, nom)")
      .order("generated_at", { ascending: false })
      .limit(5),
  ]);

  const enAttente = nbEnAttente ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">
          Bonjour {profile?.prenom ?? ""}
        </h1>
        <p className="text-caption text-muted-foreground">Votre espace coach</p>
      </header>

      {erreurNageurs ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            Impossible de charger votre tableau de bord.{" "}
            <Link href="/coach">Réessayer</Link>
          </AlertDescription>
        </Alert>
      ) : (nageurs ?? []).length === 0 ? (
        // B2/PC-2 : état vide — aucun nageur affecté.
        <Card>
          <CardHeader>
            <CardTitle>Aucun nageur ne vous est encore affecté</CardTitle>
            <CardDescription>
              Un administrateur doit vous affecter des nageurs. Vous verrez alors ici leurs
              séances à valider et leur suivi.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <section aria-label="Accès rapides" className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader className="flex-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="size-5 text-primary" aria-hidden />
                  Séances à valider
                </CardTitle>
                <CardDescription>
                  {enAttente === 0
                    ? "Aucune séance en attente de validation."
                    : enAttente === 1
                      ? "1 séance en attente de votre validation."
                      : `${enAttente} séances en attente de votre validation.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant={enAttente > 0 ? "default" : "outline"}>
                  <Link href="/coach/seances">Relire les séances</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-5 text-primary" aria-hidden />
                  Mes nageurs
                </CardTitle>
                <CardDescription>
                  {(nageurs ?? []).length === 1
                    ? "1 nageur suivi — profil, historique et auto-évaluations."
                    : `${(nageurs ?? []).length} nageurs suivis — profils, historiques et auto-évaluations.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/coach/nageurs">Voir mes nageurs</Link>
                </Button>
              </CardContent>
            </Card>
          </section>

          <section aria-label="Nageurs suivis" className="space-y-3">
            <h2 className="text-lg font-semibold">Nageurs suivis</h2>
            <ul className="flex flex-wrap gap-2">
              {(nageurs ?? []).map((nageur) => (
                <li key={nageur.id}>
                  <Link
                    href={`/coach/nageurs/${nageur.id}`}
                    className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {nageur.prenom} {nageur.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Dernières séances générées" className="space-y-3">
            <h2 className="text-lg font-semibold">Dernières séances générées</h2>
            {(seancesRecentes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune séance générée par vos nageurs pour le moment.
              </p>
            ) : (
              <ul className="space-y-3">
                {((seancesRecentes ?? []) as unknown as SeanceRecente[]).map((seance) => (
                  <li key={seance.id}>
                    <Link
                      href={`/coach/seances/${seance.id}`}
                      className="group block rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <Card className="transition-shadow group-hover:shadow-md">
                        <CardContent className="flex items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <p className="text-sm font-semibold">
                              {seance.nageur
                                ? `${seance.nageur.prenom} ${seance.nageur.nom}`
                                : "Nageur"}
                            </p>
                            <p className="text-caption text-muted-foreground">
                              Séance du {formatDateSeance(seance.generated_at)}
                            </p>
                            <StatutBadge statut={seance.statut} />
                          </div>
                          <ChevronRight
                            className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
