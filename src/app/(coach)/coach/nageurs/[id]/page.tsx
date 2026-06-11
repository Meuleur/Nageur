import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BASSIN_LABELS,
  DUREE_LABELS,
  JOUR_LABELS,
  MATERIEL_LABELS,
  MOMENT_LABELS,
  NIVEAU_LABELS,
  OBJECTIF_LABELS,
} from "@/features/profil/labels";
import type { Materiel, Niveau, Objectif } from "@/features/profil/schemas";
import type { Moment } from "@/features/profil/creneaux";
import { StatutBadge } from "@/features/seances/components/statut-badge";
import { formatDateSeance, formatDistance, formatDuree } from "@/features/seances/labels";
import type { StatutSeance } from "@/features/seances/statuts";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Détail du nageur — App Natation" };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function NageurIntrouvable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Nageur introuvable</h2>
        </CardTitle>
        <CardDescription>
          Ce nageur n&apos;existe pas ou ne vous est pas affecté.{" "}
          <Link href="/coach/nageurs" className="text-primary underline underline-offset-2">
            Retour à mes nageurs
          </Link>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

type SeanceHistorique = {
  id: string;
  statut: StatutSeance;
  generated_at: string;
  distance_totale_m: number | null;
  duree_estimee_min: number | null;
  auto_evaluations: {
    ressenti: number;
    difficulte: number | null;
    commentaire: string | null;
  } | null;
};

/** Ligne « libellé : valeur » du profil sportif. */
function LigneProfil({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <p>
      {libelle}&nbsp;: <strong>{valeur}</strong>
    </p>
  );
}

/**
 * E-24 — Détail d'un nageur (PC-5) : profil sportif, historique des séances
 * (tous statuts) et auto-évaluations (RG-35 : visibles par le nageur et son
 * coach uniquement). Lectures sous RLS (E1) : un nageur non affecté est
 * introuvable (RG-25, RG-43).
 */
export default async function DetailNageurPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const entete = (contenu: React.ReactNode) => (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <Link
        href="/coach/nageurs"
        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à mes nageurs
      </Link>
      {contenu}
    </main>
  );

  if (!UUID_REGEX.test(id)) {
    return entete(<NageurIntrouvable />);
  }

  // RLS : seul le profil d'un nageur affecté est lisible — le filtre coach_id
  // est porté par la policy, la requête reste explicite (défense en profondeur).
  const { data: nageur, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .eq("id", id)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (error) {
    return entete(
      <Alert variant="destructive">
        <AlertDescription>
          Impossible de charger le nageur. <Link href={`/coach/nageurs/${id}`}>Réessayer</Link>
        </AlertDescription>
      </Alert>,
    );
  }
  if (!nageur) {
    return entete(<NageurIntrouvable />);
  }

  const [{ data: profilSportif }, { data: disponibilites }, { data: seances, error: erreurSeances }] =
    await Promise.all([
      supabase
        .from("swimmer_profiles")
        .select("niveau, frequence, duree, bassin, objectifs, materiel")
        .eq("nageur_id", id)
        .maybeSingle(),
      supabase
        .from("swimmer_availabilities")
        .select("jour, moment")
        .eq("nageur_id", id)
        .order("jour", { ascending: true }),
      supabase
        .from("seances")
        .select(
          "id, statut, generated_at, distance_totale_m, duree_estimee_min, auto_evaluations(ressenti, difficulte, commentaire)",
        )
        .eq("nageur_id", id)
        .order("generated_at", { ascending: false }),
    ]);

  return entete(
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">
          {nageur.prenom} {nageur.nom}
        </h1>
        <p className="text-caption text-muted-foreground">
          Profil, historique des séances et auto-évaluations.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Profil sportif</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {profilSportif ? (
            <>
              <LigneProfil
                libelle="Niveau"
                valeur={NIVEAU_LABELS[profilSportif.niveau as Niveau] ?? profilSportif.niveau}
              />
              <LigneProfil
                libelle="Fréquence"
                valeur={`${profilSportif.frequence} séance${profilSportif.frequence > 1 ? "s" : ""} / semaine`}
              />
              <LigneProfil
                libelle="Durée souhaitée"
                valeur={DUREE_LABELS[profilSportif.duree] ?? `${profilSportif.duree} min`}
              />
              <LigneProfil
                libelle="Bassin"
                valeur={BASSIN_LABELS[profilSportif.bassin] ?? `${profilSportif.bassin} m`}
              />
              <LigneProfil
                libelle="Objectifs"
                valeur={(profilSportif.objectifs as Objectif[])
                  .map((objectif) => OBJECTIF_LABELS[objectif] ?? objectif)
                  .join(", ")}
              />
              <LigneProfil
                libelle="Matériel"
                valeur={
                  (profilSportif.materiel ?? []).length === 0
                    ? "Aucun"
                    : (profilSportif.materiel as Materiel[])
                        .map((materiel) => MATERIEL_LABELS[materiel] ?? materiel)
                        .join(", ")
                }
              />
              <LigneProfil
                libelle="Disponibilités"
                valeur={
                  (disponibilites ?? []).length === 0
                    ? "Non renseignées"
                    : (disponibilites ?? [])
                        .map(
                          (creneau) =>
                            `${JOUR_LABELS[creneau.jour]} ${MOMENT_LABELS[creneau.moment as Moment].toLowerCase()}`,
                        )
                        .join(", ")
                }
              />
            </>
          ) : (
            <p className="text-muted-foreground">
              Profil sportif non renseigné — la génération de séances reste indisponible pour ce
              nageur (RG-17).
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-label="Historique des séances" className="space-y-3">
        <h2 className="text-lg font-semibold">Historique des séances</h2>
        {erreurSeances ? (
          <Alert variant="destructive">
            <AlertDescription>
              Impossible de charger les séances.{" "}
              <Link href={`/coach/nageurs/${id}`}>Réessayer</Link>
            </AlertDescription>
          </Alert>
        ) : (seances ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune séance générée pour ce nageur pour le moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {((seances ?? []) as unknown as SeanceHistorique[]).map((seance) => (
              <li key={seance.id}>
                <Link
                  href={`/coach/seances/${seance.id}`}
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
                        {seance.auto_evaluations ? (
                          // RG-35 : ressenti du nageur, visible par son coach.
                          <p className="text-caption">
                            Auto-évaluation&nbsp;: ressenti{" "}
                            <strong>{seance.auto_evaluations.ressenti} / 5</strong>
                            {seance.auto_evaluations.difficulte === null
                              ? ""
                              : ` · difficulté ${seance.auto_evaluations.difficulte} / 10`}
                            {seance.auto_evaluations.commentaire ? (
                              <span className="text-muted-foreground">
                                {" "}
                                — « {seance.auto_evaluations.commentaire} »
                              </span>
                            ) : null}
                          </p>
                        ) : null}
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
    </>,
  );
}
