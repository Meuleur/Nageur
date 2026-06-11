import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateSeance, formatDistance, formatDuree } from "@/features/seances/labels";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Séances à valider — App Natation" };

type SeanceAValider = {
  id: string;
  generated_at: string;
  distance_totale_m: number | null;
  duree_estimee_min: number | null;
  nageur: { prenom: string; nom: string } | null;
};

/**
 * E-21 — Séances à valider (PC-3, RG-25) : séances en_attente des nageurs
 * affectés, lues sous RLS (E1), triées par date — les plus anciennes
 * d'abord, à traiter en premier. État vide explicite (B2).
 */
export default async function SeancesAValiderPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const { data: seances, error } = await supabase
    .from("seances")
    .select(
      "id, generated_at, distance_totale_m, duree_estimee_min, nageur:profiles!seances_nageur_id_fkey(prenom, nom)",
    )
    .eq("statut", "en_attente")
    .order("generated_at", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Link
          href="/coach"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour au tableau de bord
        </Link>
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">Séances à valider</h1>
        <p className="text-caption text-muted-foreground">
          Les séances proposées par l&apos;IA pour vos nageurs, en attente de votre relecture —
          les plus anciennes en premier.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            Impossible de charger les séances à valider.{" "}
            <Link href="/coach/seances">Réessayer</Link>
          </AlertDescription>
        </Alert>
      ) : (seances ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="size-8 text-status-valid" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucune séance en attente de validation. Vous serez sollicité dès qu&apos;un de vos
              nageurs générera une séance.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {((seances ?? []) as unknown as SeanceAValider[]).map((seance) => (
            <li key={seance.id}>
              <Link
                href={`/coach/seances/${seance.id}`}
                className="group block rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="transition-shadow group-hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold">
                        {seance.nageur ? `${seance.nageur.prenom} ${seance.nageur.nom}` : "Nageur"}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        Séance du {formatDateSeance(seance.generated_at)}
                        {[
                          seance.distance_totale_m === null
                            ? null
                            : formatDistance(seance.distance_totale_m),
                          seance.duree_estimee_min === null
                            ? null
                            : `≈ ${formatDuree(seance.duree_estimee_min)}`,
                        ]
                          .filter(Boolean)
                          .map((partie) => ` · ${partie}`)
                          .join("")}
                      </p>
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
    </main>
  );
}
