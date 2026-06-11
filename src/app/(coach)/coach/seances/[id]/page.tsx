import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageSquareQuote, Ruler, Timer } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SeanceContenu,
  type SerieAffichee,
} from "@/features/seances/components/seance-contenu";
import { StatutBadge } from "@/features/seances/components/statut-badge";
import { formatDateSeance, formatDistance, formatDuree } from "@/features/seances/labels";
import { estStatutSeance } from "@/features/seances/statuts";
import { TraitementActions } from "@/features/validation/components/traitement-actions";
import { peutEtreTraitee } from "@/features/validation/transitions";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Relecture de la séance — App Natation" };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Retour visuel après traitement (B2 : confirmation après action). */
const CONFIRMATIONS: Record<string, string> = {
  validee: "La séance a été validée — votre nageur peut maintenant l'utiliser.",
  modifiee: "La séance a été modifiée et validée — votre nageur peut maintenant l'utiliser.",
  refusee:
    "La séance a été refusée — votre nageur verra votre commentaire et pourra demander une nouvelle séance.",
};

function SeanceIntrouvable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Séance introuvable</h2>
        </CardTitle>
        <CardDescription>
          Cette séance n&apos;existe pas ou ne concerne pas l&apos;un de vos nageurs.{" "}
          <Link href="/coach/seances" className="text-primary underline underline-offset-2">
            Retour aux séances à valider
          </Link>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

/**
 * E-22 — Relecture / validation d'une séance (PC-3, RG-26) : détail complet
 * de la proposition + trois actions exclusives sur une séance en attente.
 * Sert aussi de détail aux séances déjà traitées (historique E-20/E-24) :
 * les actions disparaissent (statuts terminaux, A3) et l'auto-évaluation du
 * nageur s'affiche (RG-35). Lectures sous RLS : seances/series/auto_evaluations
 * des nageurs affectés uniquement (RG-25, RG-43).
 */
export default async function RelectureSeancePage({
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
  const traitement = (await searchParams).traitement;
  const confirmation =
    typeof traitement === "string" ? (CONFIRMATIONS[traitement] ?? null) : null;

  const entete = (contenu: React.ReactNode) => (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <Link
        href="/coach/seances"
        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux séances à valider
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
      "id, statut, generated_at, echauffement_distance_m, echauffement_consignes, retour_calme_distance_m, retour_calme_consignes, distance_totale_m, duree_estimee_min, commentaire_coach, nageur:profiles!seances_nageur_id_fkey(id, prenom, nom)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return entete(
      <Alert variant="destructive">
        <AlertDescription>
          Impossible de charger la séance.{" "}
          <Link href={`/coach/seances/${id}`}>Réessayer</Link>
        </AlertDescription>
      </Alert>,
    );
  }
  if (!seance || !estStatutSeance(seance.statut)) {
    return entete(<SeanceIntrouvable />);
  }

  const nageur = seance.nageur as unknown as { id: string; prenom: string; nom: string } | null;

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
          <Link href={`/coach/seances/${id}`}>Réessayer</Link>
        </AlertDescription>
      </Alert>,
    );
  }

  return entete(
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">
          Séance de {nageur ? `${nageur.prenom} ${nageur.nom}` : "votre nageur"}
        </h1>
        <p className="text-caption text-muted-foreground">
          Générée le {formatDateSeance(seance.generated_at)}
        </p>
        <StatutBadge statut={seance.statut} />
      </header>

      {confirmation ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertDescription>{confirmation}</AlertDescription>
        </Alert>
      ) : null}

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

      <SeanceContenu seance={seance} series={(series ?? []) as SerieAffichee[]} />

      {peutEtreTraitee(seance.statut) ? (
        // PC-3 : trois actions exclusives (RG-26) ; transitions côté serveur.
        <TraitementActions seanceId={seance.id} />
      ) : (
        <>
          {seance.commentaire_coach ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareQuote className="size-5 text-primary" aria-hidden />
                  <h2>Votre commentaire</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{seance.commentaire_coach}</CardContent>
            </Card>
          ) : null}

          {autoEvaluation ? (
            // RG-35 : auto-évaluation visible par le coach du nageur uniquement.
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Auto-évaluation du nageur</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
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
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </>,
  );
}
