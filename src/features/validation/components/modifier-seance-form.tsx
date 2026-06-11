"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDistance, TYPE_NAGE_LABELS } from "@/features/seances/labels";
import { TYPES_NAGE } from "@/features/seances/schemas";

import { modifierEtValiderSeanceAction } from "../actions";
import { MODIFICATION_FORM_IDLE } from "../form-state";
import {
  COMMENTAIRE_COACH_MAX,
  formatErreursModification,
  modificationSeanceSchema,
  parseModificationFormData,
} from "../schemas";

export type SerieInitiale = {
  repetitions: number;
  distance_m: number;
  type_nage: string;
  recuperation_s: number;
  consigne: string | null;
};

export type SeanceAModifier = {
  seanceId: string;
  echauffement: { distance_m: number | null; consignes: string | null };
  series: SerieInitiale[];
  retourCalme: { distance_m: number | null; consignes: string | null };
  commentaire: string | null;
};

/** Ligne de série éditée — valeurs textuelles (état contrôlé d'inputs). */
type SerieEditee = {
  cle: number;
  repetitions: string;
  distance: string;
  typeNage: string;
  recuperation: string;
  consigne: string;
};

/** Select natif aligné sur le style Input (B4) — pas de Select shadcn en v1. */
function SelectNage(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className="flex h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
    >
      {TYPES_NAGE.map((type) => (
        <option key={type} value={type}>
          {TYPE_NAGE_LABELS[type]}
        </option>
      ))}
    </select>
  );
}

/**
 * E-23 — Modifier une séance avant validation (PC-4, T3, RG-28) : édition de
 * l'échauffement, des séries (ajout / suppression / réordonnancement,
 * répétitions, distance multiple de 25 m, type de nage, récupération,
 * consignes), du retour au calme et du commentaire. « Valider » applique la
 * transition serveur vers `modifiee` ; « Annuler » abandonne tout — la séance
 * reste en attente (ADR-018). Formulaire contrôlé (React 19) ; validation
 * client avec le MÊME schéma Zod que le serveur (D2). Les champs des séries
 * sont indexés dans l'ordre d'affichage : l'index suit le réordonnancement.
 */
export function ModifierSeanceForm({ seance }: { seance: SeanceAModifier }) {
  const [state, formAction, isPending] = useActionState(
    modifierEtValiderSeanceAction,
    MODIFICATION_FORM_IDLE,
  );

  const prochaineCle = useRef(seance.series.length);
  const [series, setSeries] = useState<SerieEditee[]>(() =>
    seance.series.map((serie, index) => ({
      cle: index,
      repetitions: String(serie.repetitions),
      distance: String(serie.distance_m),
      typeNage: serie.type_nage,
      recuperation: String(serie.recuperation_s),
      consigne: serie.consigne ?? "",
    })),
  );

  const [echauffementDistance, setEchauffementDistance] = useState(
    seance.echauffement.distance_m === null ? "" : String(seance.echauffement.distance_m),
  );
  const [echauffementConsignes, setEchauffementConsignes] = useState(
    seance.echauffement.consignes ?? "",
  );
  const [retourDistance, setRetourDistance] = useState(
    seance.retourCalme.distance_m === null ? "" : String(seance.retourCalme.distance_m),
  );
  const [retourConsignes, setRetourConsignes] = useState(seance.retourCalme.consignes ?? "");
  const [commentaire, setCommentaire] = useState(seance.commentaire ?? "");

  const [erreursClient, setErreursClient] = useState<string[]>([]);

  const ajouterSerie = () => {
    // Clé réservée HORS de l'updater : React (StrictMode) peut le rejouer,
    // il doit rester pur.
    const cle = prochaineCle.current;
    prochaineCle.current += 1;
    setSeries((actuelles) => [
      ...actuelles,
      {
        cle,
        repetitions: "1",
        distance: "50",
        typeNage: TYPES_NAGE[0],
        recuperation: "30",
        consigne: "",
      },
    ]);
  };

  const supprimerSerie = (cle: number) => {
    setSeries((actuelles) => actuelles.filter((serie) => serie.cle !== cle));
  };

  const deplacerSerie = (cle: number, direction: -1 | 1) => {
    setSeries((actuelles) => {
      const depart = actuelles.findIndex((serie) => serie.cle === cle);
      const arrivee = depart + direction;
      if (depart < 0 || arrivee < 0 || arrivee >= actuelles.length) {
        return actuelles;
      }
      const copie = [...actuelles];
      [copie[depart], copie[arrivee]] = [copie[arrivee], copie[depart]];
      return copie;
    });
  };

  const modifierSerie = (cle: number, champ: keyof Omit<SerieEditee, "cle">, valeur: string) => {
    setSeries((actuelles) =>
      actuelles.map((serie) => (serie.cle === cle ? { ...serie, [champ]: valeur } : serie)),
    );
  };

  // E1 : distance totale cohérente — aperçu recalculé en direct (le serveur
  // recalcule de son côté, la valeur affichée n'est jamais soumise).
  const nombreOuZero = (texte: string) => {
    const n = Number(texte.trim());
    return Number.isFinite(n) ? n : 0;
  };
  const distanceTotale =
    nombreOuZero(echauffementDistance) +
    nombreOuZero(retourDistance) +
    series.reduce(
      (total, serie) => total + nombreOuZero(serie.repetitions) * nombreOuZero(serie.distance),
      0,
    );

  // Validation client au MÊME schéma que le serveur (D2) avant soumission.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const parsed = modificationSeanceSchema.safeParse(
      parseModificationFormData(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      event.preventDefault();
      setErreursClient(formatErreursModification(parsed.error));
      return;
    }
    setErreursClient([]);
  };

  const erreurs = erreursClient.length > 0 ? erreursClient : (state.erreurs ?? []);
  const afficherErreur = erreursClient.length > 0 || state.status === "error";

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onReset={(event) => event.preventDefault()}
      noValidate
      className="space-y-6"
    >
      <input type="hidden" name="seance_id" value={seance.seanceId} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Échauffement</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="echauffement_distance_m">Distance (m)</Label>
            <Input
              id="echauffement_distance_m"
              name="echauffement_distance_m"
              type="number"
              inputMode="numeric"
              min={0}
              step={25}
              value={echauffementDistance}
              onChange={(event) => setEchauffementDistance(event.target.value)}
              className="max-w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="echauffement_consignes">Consignes</Label>
            <Textarea
              id="echauffement_consignes"
              name="echauffement_consignes"
              value={echauffementConsignes}
              onChange={(event) => setEchauffementConsignes(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Corps de séance</h2>
          </CardTitle>
          <CardDescription>
            Au moins une série ; distances multiples de 25 m. L&apos;ordre des séries est celui
            présenté au nageur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {series.map((serie, index) => (
            <fieldset key={serie.cle} className="space-y-4 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-semibold">Série {index + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`series-${serie.cle}-repetitions`}>Répétitions</Label>
                  <Input
                    id={`series-${serie.cle}-repetitions`}
                    name={`series.${index}.repetitions`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={serie.repetitions}
                    onChange={(event) =>
                      modifierSerie(serie.cle, "repetitions", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`series-${serie.cle}-distance`}>Distance (m)</Label>
                  <Input
                    id={`series-${serie.cle}-distance`}
                    name={`series.${index}.distance_m`}
                    type="number"
                    inputMode="numeric"
                    min={25}
                    step={25}
                    value={serie.distance}
                    onChange={(event) => modifierSerie(serie.cle, "distance", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`series-${serie.cle}-type`}>Type de nage</Label>
                  <SelectNage
                    id={`series-${serie.cle}-type`}
                    name={`series.${index}.type_nage`}
                    value={serie.typeNage}
                    onChange={(event) => modifierSerie(serie.cle, "typeNage", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`series-${serie.cle}-recuperation`}>Récupération (s)</Label>
                  <Input
                    id={`series-${serie.cle}-recuperation`}
                    name={`series.${index}.recuperation_s`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={serie.recuperation}
                    onChange={(event) =>
                      modifierSerie(serie.cle, "recuperation", event.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`series-${serie.cle}-consigne`}>Consigne</Label>
                <Input
                  id={`series-${serie.cle}-consigne`}
                  name={`series.${index}.consigne`}
                  value={serie.consigne}
                  onChange={(event) => modifierSerie(serie.cle, "consigne", event.target.value)}
                  placeholder="Allure, respiration, matériel…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => deplacerSerie(serie.cle, -1)}
                  disabled={index === 0}
                  aria-label={`Monter la série ${index + 1}`}
                >
                  <ArrowUp aria-hidden />
                  Monter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => deplacerSerie(serie.cle, 1)}
                  disabled={index === series.length - 1}
                  aria-label={`Descendre la série ${index + 1}`}
                >
                  <ArrowDown aria-hidden />
                  Descendre
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => supprimerSerie(serie.cle)}
                  disabled={series.length === 1}
                  aria-label={`Supprimer la série ${index + 1}`}
                >
                  <Trash2 aria-hidden />
                  Supprimer
                </Button>
              </div>
            </fieldset>
          ))}

          <Button type="button" variant="outline" onClick={ajouterSerie}>
            <Plus aria-hidden />
            Ajouter une série
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Retour au calme</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="retour_calme_distance_m">Distance (m)</Label>
            <Input
              id="retour_calme_distance_m"
              name="retour_calme_distance_m"
              type="number"
              inputMode="numeric"
              min={0}
              step={25}
              value={retourDistance}
              onChange={(event) => setRetourDistance(event.target.value)}
              className="max-w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retour_calme_consignes">Consignes</Label>
            <Textarea
              id="retour_calme_consignes"
              name="retour_calme_consignes"
              value={retourConsignes}
              onChange={(event) => setRetourConsignes(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Commentaire pour le nageur</h2>
          </CardTitle>
          <CardDescription>Facultatif — accompagne la séance modifiée (RG-28).</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            name="commentaire"
            aria-label="Commentaire pour le nageur"
            value={commentaire}
            onChange={(event) => setCommentaire(event.target.value)}
            maxLength={COMMENTAIRE_COACH_MAX}
            placeholder="Ce que vous avez adapté et pourquoi…"
          />
        </CardContent>
      </Card>

      <p className="text-sm" aria-live="polite">
        Distance totale recalculée&nbsp;: <strong>{formatDistance(distanceTotale)}</strong>
      </p>

      {afficherErreur ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            <p>
              {erreursClient.length > 0
                ? "Séance non modifiée : corrigez les champs signalés."
                : state.message}
            </p>
            {erreurs.length > 0 ? (
              <ul className="list-disc pl-5">
                {erreurs.map((erreur) => (
                  <li key={erreur}>{erreur}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Valider
        </Button>
        {/* ADR-018 : abandonner sans écrire — la séance reste en attente. */}
        <Button asChild variant="outline" disabled={isPending}>
          <Link href={`/coach/seances/${seance.seanceId}`}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
