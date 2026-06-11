import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AutoEvaluationForm,
  type AutoEvaluationInitiale,
} from "@/features/evaluation/components/auto-evaluation-form";
import { formatDateSeance } from "@/features/seances/labels";
import { estStatutSeance, estUtilisable } from "@/features/seances/statuts";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Auto-évaluation — App Natation" };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * E-15 — Auto-évaluation (PN-9, RG-34) : accessible uniquement depuis une
 * séance utilisable (validee/modifiee) ; sinon retour au détail E-14, qui
 * affiche l'état adapté au statut. Une auto-évaluation par séance,
 * modifiable (ADR-018) — le formulaire est pré-rempli si elle existe.
 * Visible nageur + coach (RG-35, garanti par la RLS).
 */
export default async function AutoEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    redirect("/seances");
  }

  const { data: seance } = await supabase
    .from("seances")
    .select("id, statut, generated_at")
    .eq("id", id)
    .maybeSingle();
  if (!seance || !estStatutSeance(seance.statut)) {
    redirect("/seances");
  }
  if (!estUtilisable(seance.statut)) {
    // RG-34 : pas d'auto-évaluation sur une séance non utilisable.
    redirect(`/seances/${id}`);
  }

  const { data: existante } = await supabase
    .from("auto_evaluations")
    .select("ressenti, difficulte, commentaire")
    .eq("seance_id", id)
    .maybeSingle();

  const initiale: AutoEvaluationInitiale = {
    ressenti: existante?.ressenti ?? null,
    difficulte: existante?.difficulte ?? null,
    commentaire: existante?.commentaire ?? null,
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Link
          href={`/seances/${id}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à la séance
        </Link>
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">Auto-évaluation</h1>
        <p className="text-caption text-muted-foreground">
          Séance du {formatDateSeance(seance.generated_at)}. Votre ressenti est partagé avec votre
          coach uniquement{existante ? " — vous pouvez le modifier à tout moment" : ""}.
        </p>
      </header>

      {existante ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Une auto-évaluation existe déjà</CardTitle>
            <CardDescription>
              Une seule auto-évaluation par séance : enregistrer remplacera la précédente.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <AutoEvaluationForm seanceId={seance.id} initiale={initiale} />
    </main>
  );
}
