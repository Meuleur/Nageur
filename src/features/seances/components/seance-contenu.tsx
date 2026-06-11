import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { formatDistance, TYPE_NAGE_LABELS } from "../labels";
import type { TypeNage } from "../schemas";

/**
 * Contenu complet d'une séance (B2) : échauffement, corps (séries), retour
 * au calme — partagé entre le détail nageur (E-14, CH5) et la relecture
 * coach (E-22, CH6). Affichage pur : les règles de visibilité (RG-32, RLS)
 * restent à la charge des pages appelantes.
 */

export type SerieAffichee = {
  ordre: number;
  repetitions: number;
  distance_m: number;
  type_nage: TypeNage;
  recuperation_s: number;
  consigne: string | null;
};

export type ContenuSeance = {
  echauffement_distance_m: number | null;
  echauffement_consignes: string | null;
  retour_calme_distance_m: number | null;
  retour_calme_consignes: string | null;
};

export function SeanceContenu({
  seance,
  series,
}: {
  seance: ContenuSeance;
  series: SerieAffichee[];
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Échauffement</h2>
          </CardTitle>
          {seance.echauffement_distance_m === null ? null : (
            <CardDescription>{formatDistance(seance.echauffement_distance_m)}</CardDescription>
          )}
        </CardHeader>
        {seance.echauffement_consignes ? (
          <CardContent className="text-sm">{seance.echauffement_consignes}</CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Corps de séance</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {series.map((serie) => (
              <li
                key={serie.ordre}
                className="space-y-1 border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <p className="text-sm font-semibold">
                  {serie.repetitions} × {formatDistance(serie.distance_m)} —{" "}
                  {TYPE_NAGE_LABELS[serie.type_nage] ?? serie.type_nage}
                </p>
                <p className="text-caption text-muted-foreground">
                  Récupération&nbsp;: {serie.recuperation_s} s
                </p>
                {serie.consigne ? <p className="text-sm">{serie.consigne}</p> : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Retour au calme</h2>
          </CardTitle>
          {seance.retour_calme_distance_m === null ? null : (
            <CardDescription>{formatDistance(seance.retour_calme_distance_m)}</CardDescription>
          )}
        </CardHeader>
        {seance.retour_calme_consignes ? (
          <CardContent className="text-sm">{seance.retour_calme_consignes}</CardContent>
        ) : null}
      </Card>
    </>
  );
}
