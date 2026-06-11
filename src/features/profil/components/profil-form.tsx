"use client";

import { Fragment, useActionState, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChoixChip } from "@/components/ui/choix-chip";

import { enregistrerProfilAction } from "../actions";
import { JOURS, MOMENTS } from "../creneaux";
import { PROFIL_FORM_IDLE } from "../form-state";
import {
  BASSIN_LABELS,
  DUREE_LABELS,
  JOUR_LABELS,
  MATERIEL_LABELS,
  MOMENT_LABELS,
  NIVEAU_LABELS,
  OBJECTIF_LABELS,
} from "../labels";
import {
  BASSINS,
  DUREES,
  MATERIELS,
  NIVEAUX,
  OBJECTIFS,
  parseProfilFormData,
  profilSportifSchema,
} from "../schemas";

/** Valeurs déjà enregistrées (E1), ou vides au premier passage (PN-4). */
export type ProfilInitial = {
  niveau: string | null;
  frequence: number | null;
  duree: number | null;
  objectifs: string[];
  bassin: number | null;
  materiel: string[];
  /** Clés de créneaux « jour-moment » (grille E-11). */
  disponibilites: string[];
};

type FieldErrorMap = Record<string, string[] | undefined>;

/** Message d'erreur sous le groupe concerné (B2, accessibilité B4). */
function ErreursChamp({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }
  return (
    <p id={id} className="text-caption text-status-refused-text">
      {errors.join(" ")}
    </p>
  );
}

/** Groupe de champs E-11 : légende, aide, contenu, erreur ciblée. */
function ChampGroupe({
  legende,
  facultatif = false,
  aide,
  name,
  errors,
  children,
}: {
  legende: string;
  facultatif?: boolean;
  aide?: string;
  name: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  const errorId = `${name}-erreur`;
  return (
    <fieldset
      className="space-y-3 py-6 first:pt-0 last:pb-0"
      aria-describedby={errors?.length ? errorId : undefined}
    >
      <legend className="float-left mb-1 w-full text-base font-semibold">
        {legende}
        {facultatif ? (
          <span className="ml-1.5 text-caption font-normal text-muted-foreground">
            (facultatif)
          </span>
        ) : null}
      </legend>
      <div className="clear-left space-y-3">
        {aide ? <p className="text-caption text-muted-foreground">{aide}</p> : null}
        {children}
        <ErreursChamp id={errorId} errors={errors} />
      </div>
    </fieldset>
  );
}

/** E-11 — formulaire « Mon profil » (PN-4, RG-16). Contrôlé : les valeurs
 * survivent aux allers-retours de l'action serveur (React 19 réinitialise
 * les formulaires non contrôlés). */
export function ProfilForm({ initial }: { initial: ProfilInitial }) {
  const [state, formAction, isPending] = useActionState(enregistrerProfilAction, PROFIL_FORM_IDLE);

  const [niveau, setNiveau] = useState(initial.niveau ?? "");
  const [frequence, setFrequence] = useState(initial.frequence?.toString() ?? "");
  const [duree, setDuree] = useState(initial.duree?.toString() ?? "");
  const [objectifs, setObjectifs] = useState<string[]>(initial.objectifs);
  const [bassin, setBassin] = useState(initial.bassin?.toString() ?? "");
  const [materiel, setMateriel] = useState<string[]>(initial.materiel);
  const [disponibilites, setDisponibilites] = useState<string[]>(initial.disponibilites);

  // Validation client : le MÊME schéma Zod que le serveur, exécuté avant
  // l'envoi (D2) — sans JavaScript, la validation serveur reste seule juge.
  const [clientErrors, setClientErrors] = useState<FieldErrorMap>({});
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const parsed = profilSportifSchema.safeParse(
      parseProfilFormData(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(z.flattenError(parsed.error).fieldErrors as FieldErrorMap);
      return;
    }
    setClientErrors({});
  };

  const hasClientErrors = Object.values(clientErrors).some((messages) => messages?.length);
  const errors = { ...state.fieldErrors, ...clientErrors };

  const toggle = (liste: string[], valeur: string) =>
    liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

  return (
    // onReset : React 19 réinitialise le DOM du formulaire après chaque
    // action ; sur une case contrôlée, `checked` n'est PAS resynchronisé
    // (quirk React) et la soumission suivante perdrait des coches. Le
    // formulaire étant entièrement contrôlé, on annule ce reset automatique.
    <form
      action={formAction}
      onSubmit={onSubmit}
      onReset={(event) => event.preventDefault()}
      noValidate
    >
      <Card>
        <CardContent className="divide-y divide-border">
          <ChampGroupe legende="Niveau" name="niveau" errors={errors.niveau}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Niveau">
              {NIVEAUX.map((valeur) => (
                <ChoixChip
                  key={valeur}
                  type="radio"
                  name="niveau"
                  value={valeur}
                  label={NIVEAU_LABELS[valeur]}
                  checked={niveau === valeur}
                  onChange={() => setNiveau(valeur)}
                />
              ))}
            </div>
          </ChampGroupe>

          <ChampGroupe
            legende="Fréquence"
            aide="Nombre de séances par semaine."
            name="frequence"
            errors={errors.frequence}
          >
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fréquence">
              {["1", "2", "3", "4", "5", "6", "7"].map((valeur) => (
                <ChoixChip
                  key={valeur}
                  type="radio"
                  name="frequence"
                  value={valeur}
                  label={valeur}
                  ariaLabel={`${valeur} séance${valeur === "1" ? "" : "s"} par semaine`}
                  checked={frequence === valeur}
                  onChange={() => setFrequence(valeur)}
                />
              ))}
            </div>
          </ChampGroupe>

          <ChampGroupe legende="Durée habituelle" name="duree" errors={errors.duree}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Durée habituelle">
              {DUREES.map((valeur) => (
                <ChoixChip
                  key={valeur}
                  type="radio"
                  name="duree"
                  value={String(valeur)}
                  label={DUREE_LABELS[valeur]}
                  checked={duree === String(valeur)}
                  onChange={() => setDuree(String(valeur))}
                />
              ))}
            </div>
          </ChampGroupe>

          <ChampGroupe
            legende="Objectifs"
            aide="Au moins un objectif — plusieurs choix possibles."
            name="objectifs"
            errors={errors.objectifs}
          >
            <div className="flex flex-wrap gap-2">
              {OBJECTIFS.map((valeur) => (
                <ChoixChip
                  key={valeur}
                  type="checkbox"
                  name="objectifs"
                  value={valeur}
                  label={OBJECTIF_LABELS[valeur]}
                  checked={objectifs.includes(valeur)}
                  onChange={() => setObjectifs(toggle(objectifs, valeur))}
                />
              ))}
            </div>
          </ChampGroupe>

          <ChampGroupe
            legende="Disponibilités"
            facultatif
            aide="Cochez vos créneaux habituels — l'IA s'adapte à leur absence."
            name="disponibilites"
            errors={errors.disponibilites}
          >
            <div className="grid max-w-md grid-cols-[auto_repeat(3,1fr)] items-center gap-x-2">
              <span aria-hidden />
              {MOMENTS.map((moment) => (
                <span
                  key={moment}
                  className="text-center text-caption font-medium text-muted-foreground"
                >
                  {MOMENT_LABELS[moment]}
                </span>
              ))}
              {JOURS.map((jour) => (
                <Fragment key={jour}>
                  <span className="text-sm">{JOUR_LABELS[jour]}</span>
                  {MOMENTS.map((moment) => {
                    const cle = `${jour}-${moment}`;
                    return (
                      <label
                        key={moment}
                        className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"
                      >
                        <input
                          type="checkbox"
                          name="disponibilites"
                          value={cle}
                          checked={disponibilites.includes(cle)}
                          onChange={() => setDisponibilites(toggle(disponibilites, cle))}
                          aria-label={`${JOUR_LABELS[jour]} ${moment}`}
                          className="size-5 accent-primary"
                        />
                      </label>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </ChampGroupe>

          <ChampGroupe legende="Bassin" name="bassin" errors={errors.bassin}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bassin">
              {BASSINS.map((valeur) => (
                <ChoixChip
                  key={valeur}
                  type="radio"
                  name="bassin"
                  value={String(valeur)}
                  label={BASSIN_LABELS[valeur]}
                  checked={bassin === String(valeur)}
                  onChange={() => setBassin(String(valeur))}
                />
              ))}
            </div>
          </ChampGroupe>

          <ChampGroupe legende="Matériel" facultatif name="materiel" errors={errors.materiel}>
            <div className="flex flex-wrap gap-2">
              {MATERIELS.map((valeur) => (
                <ChoixChip
                  key={valeur}
                  type="checkbox"
                  name="materiel"
                  value={valeur}
                  label={MATERIEL_LABELS[valeur]}
                  checked={materiel.includes(valeur)}
                  onChange={() => setMateriel(toggle(materiel, valeur))}
                />
              ))}
            </div>
          </ChampGroupe>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-4">
        {hasClientErrors || (state.status === "error" && state.message) ? (
          <Alert variant="destructive">
            <AlertDescription>
              {hasClientErrors
                ? "Profil non enregistré : corrigez les champs signalés."
                : state.message}
            </AlertDescription>
          </Alert>
        ) : null}
        {state.status === "success" && !hasClientErrors ? (
          <Alert variant="success">
            <CheckCircle2 aria-hidden />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Enregistrement…
            </>
          ) : (
            "Enregistrer mon profil"
          )}
        </Button>
      </div>
    </form>
  );
}
