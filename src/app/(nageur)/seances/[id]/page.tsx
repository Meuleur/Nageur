import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, MessageSquareQuote, Ruler, Timer } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SeanceContenu,
  type SerieAffichee,
} from "@/features/seances/components/seance-contenu";
import { StatutBadge } from "@/features/seances/components/statut-badge";
import { formatDateSeance, formatDistance, formatDuree } from "@/features/seances/labels";
import { estStatutSeance } from "@/features/seances/statuts";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Détail de la séance — App Natation" };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SeanceIntrouvable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Séance introuvable</h2>
        </CardTitle>
        <CardDescription>
          Cette séance n&apos;existe pas ou ne vous appartient pas.{" "}
          <Link href="/seances" className="text-primary underline underline-offset-2">
            Retour à mes séances
          </Link>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

/**
 * E-14 — Détail d'une séance (PN-7/PN-8, RG-32) :
 *   - utilisable (validee/modifiee) → contenu complet + accès auto-évaluation ;
 *   - refusée → commentaire de refus (RG-29) + nouvelle génération (RG-33) ;
 *   - en attente → aperçu limité, non utilisable (A3).
 * Lectures sous RLS : la séance appartient au nageur connecté ; les séries ne
 * sont lisibles que pour une séance utilisable (E1).
 */
export default async function DetailSeancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const confirmationEvaluation = (await searchParams).evaluation === "enregistree";

  const entete = (contenu: React.ReactNode) => (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <Link
        href="/seances"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à mes séances
      </Link>
      {contenu}
    </main>
  );

  if (!UUID_REGEX.test(id)) {
    return entete(<SeanceIntrouvable />);
  }

  const { data: seance, error } = await supabase
    .from("seances")
    .select(
      "id, statut, generated_at, echauffement_distance_m, echauffement_consignes, retour_calme_distance_m, retour_calme_consignes, distance_totale_m, duree_estimee_min, commentaire_coach",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return entete(
      <Alert variant="destructive">
        <AlertDescription>
          Impossible de charger la séance.{" "}
          <Link href={`/seances/${id}`}>Réessayer</Link>
        </AlertDescription>
      </Alert>,
    );
  }
  if (!seance || !estStatutSeance(seance.statut)) {
    return entete(<SeanceIntrouvable />);
  }

  const titre = (
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">
        Séance du {formatDateSeance(seance.generated_at)}
      </h1>
      <StatutBadge statut={seance.statut} />
    </header>
  );

  const resume = (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {seance.distance_totale_m === null ? null : (
        <span className="inline-flex items-center gap-1.5">
          <Ruler className="size-4 text-primary" aria-hidden />
          Distance totale&nbsp;: <strong>{formatDistance(seance.distance_totale_m)}</strong>
        </span>
      )}
      {seance.duree_estimee_min === null ? null : (
        <span className="inline-flex items-center gap-1.5">
          <Timer className="size-4 text-primary" aria-hidden />
          Durée estimée&nbsp;: <strong>{formatDuree(seance.duree_estimee_min)}</strong>
        </span>
      )}
    </div>
  );

  // --- Séance en attente : aperçu limité, non utilisable (RG-32/A3). ---
  if (seance.statut === "en_attente") {
    return entete(
      <>
        {titre}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-status-pending" aria-hidden />
              <h2>En attente de validation</h2>
            </CardTitle>
            <CardDescription>
              Votre coach n&apos;a pas encore relu cette séance. Son contenu détaillé sera
              disponible une fois la séance validée — elle n&apos;est pas encore utilisable.
            </CardDescription>
          </CardHeader>
          <CardContent>{resume}</CardContent>
        </Card>
      </>,
    );
  }

  // --- Séance refusée : commentaire obligatoire (RG-29) + relance (RG-33). ---
  if (seance.statut === "refusee") {
    return entete(
      <>
        {titre}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareQuote className="size-5 text-status-refused" aria-hidden />
              <h2>Commentaire de votre coach</h2>
            </CardTitle>
            <CardDescription>
              Cette séance a été refusée — elle n&apos;est pas utilisable. Vous pouvez demander
              une nouvelle séance dès maintenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <blockquote className="rounded-md border-l-4 border-status-refused bg-status-refused-soft p-4 text-sm text-status-refused-text">
              {seance.commentaire_coach}
            </blockquote>
            <Button asChild>
              <Link href="/seances/generer">Générer une nouvelle séance</Link>
            </Button>
          </CardContent>
        </Card>
      </>,
    );
  }

  // --- Séance utilisable (validee/modifiee) : contenu complet (PN-7). ---
  const [{ data: series, error: erreurSeries }, { data: autoEvaluation }] = await Promise.all([
    supabase
      .from("series")
      .select("ordre, repetitions, distance_m, type_nage, recuperation_s, consigne")
      .eq("seance_id", seance.id)
      .order("ordre", { ascending: true }),
    supabase
      .from("auto_evaluations")
      .select("ressenti, difficulte, commentaire")
      .eq("seance_id", seance.id)
      .maybeSingle(),
  ]);

  if (erreurSeries) {
    return entete(
      <Alert variant="destructive">
        <AlertDescription>
          Impossible de charger le contenu de la séance.{" "}
          <Link href={`/seances/${id}`}>Réessayer</Link>
        </AlertDescription>
      </Alert>,
    );
  }

  return entete(
    <>
      {titre}

      {confirmationEvaluation ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertDescription>Votre auto-évaluation a été enregistrée.</AlertDescription>
        </Alert>
      ) : null}

      {resume}

      <SeanceContenu seance={seance} series={(series ?? []) as SerieAffichee[]} />

      {seance.commentaire_coach ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareQuote className="size-5 text-primary" aria-hidden />
              <h2>Commentaire de votre coach</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{seance.commentaire_coach}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Mon ressenti</h2>
          </CardTitle>
          <CardDescription>
            {autoEvaluation
              ? "Votre auto-évaluation — modifiable à tout moment."
              : "Après votre entraînement, dites à votre coach comment la séance s'est passée."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {autoEvaluation ? (
            <div className="space-y-1 text-sm">
              <p>
                Ressenti global&nbsp;: <strong>{autoEvaluation.ressenti} / 5</strong>
              </p>
              {autoEvaluation.difficulte === null ? null : (
                <p>
                  Difficulté perçue&nbsp;: <strong>{autoEvaluation.difficulte} / 10</strong>
                </p>
              )}
              {autoEvaluation.commentaire ? (
                <p className="text-muted-foreground">« {autoEvaluation.commentaire} »</p>
              ) : null}
            </div>
          ) : null}
          <Button asChild variant={autoEvaluation ? "outline" : "default"}>
            <Link href={`/seances/${seance.id}/auto-evaluation`}>
              {autoEvaluation ? "Modifier mon auto-évaluation" : "S'auto-évaluer"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>,
  );
}
