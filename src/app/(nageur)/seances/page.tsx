import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Waves } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatutBadge } from "@/features/seances/components/statut-badge";
import { formatDateSeance, formatDistance, formatDuree } from "@/features/seances/labels";
import {
  estStatutSeance,
  STATUT_LABELS,
  STATUTS_SEANCE,
  type StatutSeance,
} from "@/features/seances/statuts";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Mes séances — App Natation" };

/** Pastille de filtre par statut (ADR-018) — lien, état actif visible (B4). */
function FiltreChip({
  href,
  actif,
  children,
}: {
  href: string;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors select-none ${
        actif
          ? "border-primary/50 bg-primary-soft text-primary-hover"
          : "border-border bg-card hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}

type SeanceListee = {
  id: string;
  statut: StatutSeance;
  generated_at: string;
  distance_totale_m: number | null;
  duree_estimee_min: number | null;
};

/**
 * E-13 — Mes séances (PN-6, RG-32) : toutes les séances du nageur, lues sous
 * RLS, avec badge de statut (B4) et filtre par statut (ADR-018). États vide /
 * erreur explicites (B2) ; le chargement est couvert par loading.tsx.
 */
export default async function MesSeancesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const params = await searchParams;
  const filtre = estStatutSeance(params.statut) ? params.statut : null;
  const confirmationGeneration = params.generation === "envoyee";

  let requete = supabase
    .from("seances")
    .select("id, statut, generated_at, distance_totale_m, duree_estimee_min")
    .order("generated_at", { ascending: false });
  if (filtre) {
    requete = requete.eq("statut", filtre);
  }

  const [{ data: seances, error }, { data: coach }] = await Promise.all([
    requete,
    supabase.from("my_coach").select("prenom, nom").maybeSingle(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Link
          href="/accueil"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à l&apos;accueil
        </Link>
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">Mes séances</h1>
        <p className="text-caption text-muted-foreground">
          Vos séances et leur statut de validation. Seules les séances validées ou modifiées par
          votre coach sont utilisables.
        </p>
      </header>

      {confirmationGeneration ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertDescription>
            Votre séance a été générée et envoyée à votre coach pour validation.
          </AlertDescription>
        </Alert>
      ) : null}

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        <FiltreChip href="/seances" actif={filtre === null}>
          Toutes
        </FiltreChip>
        {STATUTS_SEANCE.map((statut) => (
          <FiltreChip key={statut} href={`/seances?statut=${statut}`} actif={filtre === statut}>
            {STATUT_LABELS[statut]}
          </FiltreChip>
        ))}
      </nav>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            Impossible de charger vos séances.{" "}
            <Link href={filtre ? `/seances?statut=${filtre}` : "/seances"}>Réessayer</Link>
          </AlertDescription>
        </Alert>
      ) : (seances ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Waves className="size-8 text-muted-foreground" aria-hidden />
            {filtre ? (
              <p className="text-sm text-muted-foreground">
                Aucune séance « {STATUT_LABELS[filtre]} ».{" "}
                <Link href="/seances" className="text-primary underline underline-offset-2">
                  Voir toutes les séances
                </Link>
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Vous n&apos;avez pas encore de séance.
                </p>
                {coach ? (
                  <Button asChild>
                    <Link href="/seances/generer">Générer ma première séance</Link>
                  </Button>
                ) : (
                  <p className="text-caption text-muted-foreground">
                    La génération s&apos;ouvrira dès qu&apos;un coach vous sera affecté.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(seances as SeanceListee[]).map((seance) => (
            <li key={seance.id}>
              <Link
                href={`/seances/${seance.id}`}
                className="group block rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="transition-shadow group-hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold">
                        Séance du {formatDateSeance(seance.generated_at)}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {[
                          seance.distance_totale_m === null
                            ? null
                            : formatDistance(seance.distance_totale_m),
                          seance.duree_estimee_min === null
                            ? null
                            : `≈ ${formatDuree(seance.duree_estimee_min)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
    </main>
  );
}
