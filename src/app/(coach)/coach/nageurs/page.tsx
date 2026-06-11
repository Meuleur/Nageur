import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, ChevronRight, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Mes nageurs — App Natation" };

/**
 * E-24 — Mes nageurs (PC-5) : liste des nageurs affectés, lue sous RLS
 * (RG-25, RG-43). Chaque nageur ouvre son détail : profil, historique des
 * séances et auto-évaluations. État vide explicite (B2).
 */
export default async function MesNageursPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const { data: nageurs, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .eq("coach_id", user.id)
    .order("prenom", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Link
          href="/coach"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour au tableau de bord
        </Link>
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">Mes nageurs</h1>
        <p className="text-caption text-muted-foreground">
          Les nageurs qui vous sont affectés — profil, historique des séances et auto-évaluations.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            Impossible de charger vos nageurs. <Link href="/coach/nageurs">Réessayer</Link>
          </AlertDescription>
        </Alert>
      ) : (nageurs ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Users className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucun nageur ne vous est encore affecté. Un administrateur doit créer
              l&apos;affectation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(nageurs ?? []).map((nageur) => (
            <li key={nageur.id}>
              <Link
                href={`/coach/nageurs/${nageur.id}`}
                className="group block rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="transition-shadow group-hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold">
                      {nageur.prenom} {nageur.nom}
                    </p>
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
    </main>
  );
}
