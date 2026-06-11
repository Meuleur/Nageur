import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminEntete } from "@/features/admin/components/admin-entete";
import { GraphiquesAdmin } from "@/features/admin/components/graphiques-admin";
import { PeriodeFiltre } from "@/features/admin/components/periode-filtre";
import { exigerSuperAdmin } from "@/features/admin/garde";
import { formatTauxValidation, tauxValidation } from "@/features/admin/metriques";
import { depuisPourPeriode, PERIODE_LABELS, periodeDepuisParam } from "@/features/admin/periodes";
import { lireMetriquesAdmin } from "@/server/data/admin";

export const metadata: Metadata = { title: "Administration — App Natation" };

const FORMAT_NOMBRE = new Intl.NumberFormat("fr-FR");

function Metrique({
  libelle,
  valeur,
  detail,
  alerte,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
  alerte?: boolean;
}) {
  return (
    <Card className={alerte ? "border-status-pending/50" : undefined}>
      <CardContent className="space-y-1">
        <p className="text-caption text-muted-foreground">{libelle}</p>
        <p className="text-2xl font-semibold tabular-nums">{valeur}</p>
        {detail ? <p className="text-caption text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

/**
 * E-30 — Tableau de bord Super Admin (PA-2, RG-39) : agrégats calculés côté
 * serveur (service role, admin_metrics) — identités et chiffres uniquement,
 * jamais le contenu des séances ni les auto-évaluations (ADR-020/RG-40).
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await exigerSuperAdmin();

  const periode = periodeDepuisParam((await searchParams).periode);
  const metriques = await lireMetriquesAdmin(depuisPourPeriode(periode, new Date()));
  const taux = tauxValidation(metriques.seances);
  const n = (valeur: number) => FORMAT_NOMBRE.format(valeur);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <AdminEntete
        titre="Tableau de bord"
        description="Métriques agrégées de l'application — aucune donnée de contenu."
      />

      <section aria-label="Métriques" className="space-y-4">
        <PeriodeFiltre actif={periode} />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Metrique
            libelle={`Tokens consommés (${PERIODE_LABELS[periode].toLowerCase()})`}
            valeur={n(metriques.tokens.total)}
            detail={`Anthropic ${n(metriques.tokens.anthropic)} · OpenAI ${n(metriques.tokens.openai)}`}
          />
          <Metrique
            libelle="Séances générées"
            valeur={n(metriques.seances.generees)}
            detail={`Anthropic ${n(metriques.par_fournisseur.anthropic)} · OpenAI ${n(metriques.par_fournisseur.openai)}`}
          />
          <Metrique libelle="Taux de validation" valeur={formatTauxValidation(taux)} detail="(validées + modifiées) / générées" />
          <Metrique
            libelle="Séances en attente"
            valeur={n(metriques.seances.en_attente)}
            detail="Stock courant à relire"
            alerte={metriques.seances.en_attente > 0}
          />
          <Metrique libelle="Coachs" valeur={n(metriques.comptes.coachs)} />
          <Metrique libelle="Nageurs" valeur={n(metriques.comptes.nageurs)} />
          <Metrique
            libelle="Nageurs sans coach"
            valeur={n(metriques.comptes.nageurs_sans_coach)}
            detail="À affecter pour débloquer la génération"
            alerte={metriques.comptes.nageurs_sans_coach > 0}
          />
          <Metrique
            libelle="Validées / modifiées / refusées"
            valeur={`${n(metriques.seances.validees)} / ${n(metriques.seances.modifiees)} / ${n(metriques.seances.refusees)}`}
            detail="Traitées sur la période"
          />
        </div>

        <GraphiquesAdmin metriques={metriques} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Périmètre d&apos;accès</h2>
          </CardTitle>
          <CardDescription>
            L&apos;administration accède aux identités, aux rôles, aux affectations et à ces
            agrégats — jamais au contenu des séances ni aux auto-évaluations des nageurs
            (RG-40, ADR-020).
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
