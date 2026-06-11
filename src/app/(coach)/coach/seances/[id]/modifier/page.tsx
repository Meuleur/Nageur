import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateSeance } from "@/features/seances/labels";
import {
  ModifierSeanceForm,
  type SerieInitiale,
} from "@/features/validation/components/modifier-seance-form";
import { peutEtreTraitee } from "@/features/validation/transitions";
import { estStatutSeance } from "@/features/seances/statuts";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Modifier la séance — App Natation" };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * E-23 — Modifier une séance avant validation (PC-4, T3). Réservé aux
 * séances en attente : une séance déjà traitée n'est plus éditable (A3) —
 * retour au détail. Lectures sous RLS (RG-25) ; la transition finale passe
 * par l'action serveur (service role).
 */
export default async function ModifierSeancePage({
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
        href={`/coach/seances/${id}`}
        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la relecture
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
      "id, statut, generated_at, echauffement_distance_m, echauffement_consignes, retour_calme_distance_m, retour_calme_consignes, commentaire_coach, nageur:profiles!seances_nageur_id_fkey(prenom, nom)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return entete(
      <Alert variant="destructive">
        <AlertDescription>
          Impossible de charger la séance.{" "}
          <Link href={`/coach/seances/${id}/modifier`}>Réessayer</Link>
        </AlertDescription>
      </Alert>,
    );
  }
  if (!seance || !estStatutSeance(seance.statut)) {
    return entete(<SeanceIntrouvable />);
  }
  if (!peutEtreTraitee(seance.statut)) {
    // A3 : une séance en état terminal n'est plus éditable.
    redirect(`/coach/seances/${id}`);
  }

  const { data: series, error: erreurSeries } = await supabase
    .from("series")
    .select("repetitions, distance_m, type_nage, recuperation_s, consigne")
    .eq("seance_id", seance.id)
    .order("ordre", { ascending: true });

  if (erreurSeries) {
    return entete(
      <Alert variant="destructive">
        <AlertDescription>
          Impossible de charger le contenu de la séance.{" "}
          <Link href={`/coach/seances/${id}/modifier`}>Réessayer</Link>
        </AlertDescription>
      </Alert>,
    );
  }

  const nageur = seance.nageur as unknown as { prenom: string; nom: string } | null;

  return entete(
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">
          Modifier la séance de {nageur ? `${nageur.prenom} ${nageur.nom}` : "votre nageur"}
        </h1>
        <p className="text-caption text-muted-foreground">
          Générée le {formatDateSeance(seance.generated_at)} — « Valider » enregistre vos
          modifications et rend la séance utilisable ; « Annuler » la laisse en attente.
        </p>
      </header>

      <ModifierSeanceForm
        seance={{
          seanceId: seance.id,
          echauffement: {
            distance_m: seance.echauffement_distance_m,
            consignes: seance.echauffement_consignes,
          },
          series: (series ?? []) as SerieInitiale[],
          retourCalme: {
            distance_m: seance.retour_calme_distance_m,
            consignes: seance.retour_calme_consignes,
          },
          commentaire: seance.commentaire_coach,
        }}
      />
    </>,
  );
}
