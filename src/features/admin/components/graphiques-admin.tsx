"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetriquesAdmin } from "../metriques";

/**
 * Graphiques du tableau de bord (E-30, C4) — Recharts, sobres (B4) :
 * répartition par statut sur la période filtrée, et évolution des
 * générations sur 30 jours. Agrégats uniquement (ADR-020).
 */

// Tokens de statut B4 (valeurs hex : Recharts ne lit pas les variables CSS).
const COULEURS = {
  primaire: "#0ea5e9",
  enAttente: "#f59e0b",
  validee: "#10b981",
  modifiee: "#0ea5e9",
  refusee: "#ef4444",
  grille: "#e2e8f0",
  texte: "#64748b",
};

export function GraphiquesAdmin({ metriques }: { metriques: MetriquesAdmin }) {
  const statuts = [
    { nom: "Validées", valeur: metriques.seances.validees, couleur: COULEURS.validee },
    { nom: "Modifiées", valeur: metriques.seances.modifiees, couleur: COULEURS.modifiee },
    { nom: "Refusées", valeur: metriques.seances.refusees, couleur: COULEURS.refusee },
    { nom: "En attente", valeur: metriques.seances.en_attente, couleur: COULEURS.enAttente },
  ];

  const serie = metriques.serie_generees_30j.map((point) => ({
    ...point,
    // « 11/06 » : lisible sur un axe serré, sans année (30 jours glissants).
    label: `${point.jour.slice(8, 10)}/${point.jour.slice(5, 7)}`,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Séances par statut</h2>
          </CardTitle>
          <CardDescription>
            Validées, modifiées et refusées sur la période ; en attente : stock courant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="h-56"
            role="img"
            aria-label={`Séances par statut : ${statuts
              .map((s) => `${s.nom} ${s.valeur}`)
              .join(", ")}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statuts} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke={COULEURS.grille} vertical={false} />
                <XAxis
                  dataKey="nom"
                  tick={{ fill: COULEURS.texte, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: COULEURS.texte, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: "rgba(226, 232, 240, 0.4)" }} />
                <Bar dataKey="valeur" name="Séances" radius={[6, 6, 0, 0]}>
                  {statuts.map((statut) => (
                    <Cell key={statut.nom} fill={statut.couleur} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Générations — 30 derniers jours</h2>
          </CardTitle>
          <CardDescription>Séances générées par jour, toutes périodes confondues.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="h-56"
            role="img"
            aria-label={`Séances générées par jour sur 30 jours, total ${serie.reduce(
              (somme, point) => somme + point.generees,
              0,
            )}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke={COULEURS.grille} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: COULEURS.texte, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: COULEURS.texte, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="generees"
                  name="Générées"
                  stroke={COULEURS.primaire}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
