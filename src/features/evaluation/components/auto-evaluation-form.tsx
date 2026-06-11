"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChoixChip } from "@/components/ui/choix-chip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { enregistrerAutoEvaluationAction } from "../actions";
import { AUTO_EVALUATION_FORM_IDLE } from "../form-state";
import {
  autoEvaluationSchema,
  COMMENTAIRE_MAX,
  DIFFICULTE_VALEURS,
  parseAutoEvaluationFormData,
  RESSENTI_VALEURS,
} from "../schemas";

/** Valeurs déjà enregistrées (modification, ADR-018), ou vides. */
export type AutoEvaluationInitiale = {
  ressenti: number | null;
  difficulte: number | null;
  commentaire: string | null;
};

type FieldErrorMap = Record<string, string[] | undefined>;

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

/**
 * E-15 — formulaire d'auto-évaluation (PN-9, RG-34). Contrôlé : les valeurs
 * survivent aux allers-retours de l'action serveur (React 19 réinitialise
 * les formulaires non contrôlés — onReset annule ce reset automatique).
 * Validation client avec le MÊME schéma Zod que le serveur (D2).
 */
export function AutoEvaluationForm({
  seanceId,
  initiale,
}: {
  seanceId: string;
  initiale: AutoEvaluationInitiale;
}) {
  const [state, formAction, isPending] = useActionState(
    enregistrerAutoEvaluationAction,
    AUTO_EVALUATION_FORM_IDLE,
  );

  const [ressenti, setRessenti] = useState(initiale.ressenti?.toString() ?? "");
  const [difficulte, setDifficulte] = useState(initiale.difficulte?.toString() ?? "");
  const [commentaire, setCommentaire] = useState(initiale.commentaire ?? "");

  const [clientErrors, setClientErrors] = useState<FieldErrorMap>({});
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const parsed = autoEvaluationSchema.safeParse(
      parseAutoEvaluationFormData(new FormData(event.currentTarget)),
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

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onReset={(event) => event.preventDefault()}
      noValidate
    >
      <input type="hidden" name="seance_id" value={seanceId} />
      <Card>
        <CardContent className="divide-y divide-border">
          <fieldset
            className="space-y-3 py-6 first:pt-0 last:pb-0"
            aria-describedby={errors.ressenti?.length ? "ressenti-erreur" : undefined}
          >
            <legend className="float-left mb-1 w-full text-base font-semibold">
              Ressenti global
            </legend>
            <div className="clear-left space-y-3">
              <p className="text-caption text-muted-foreground">
                De 1 (très mauvaise séance) à 5 (excellente séance).
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ressenti global">
                {RESSENTI_VALEURS.map((valeur) => (
                  <ChoixChip
                    key={valeur}
                    type="radio"
                    name="ressenti"
                    value={valeur}
                    label={valeur}
                    ariaLabel={`Ressenti ${valeur} sur 5`}
                    checked={ressenti === valeur}
                    onChange={() => setRessenti(valeur)}
                  />
                ))}
              </div>
              <ErreursChamp id="ressenti-erreur" errors={errors.ressenti} />
            </div>
          </fieldset>

          <fieldset
            className="space-y-3 py-6 first:pt-0 last:pb-0"
            aria-describedby={errors.difficulte?.length ? "difficulte-erreur" : undefined}
          >
            <legend className="float-left mb-1 w-full text-base font-semibold">
              Difficulté perçue
              <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                (facultatif)
              </span>
            </legend>
            <div className="clear-left space-y-3">
              <p className="text-caption text-muted-foreground">
                De 1 (très facile) à 10 (épuisante).
              </p>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Difficulté perçue"
              >
                <ChoixChip
                  type="radio"
                  name="difficulte"
                  value=""
                  label="Non précisée"
                  checked={difficulte === ""}
                  onChange={() => setDifficulte("")}
                />
                {DIFFICULTE_VALEURS.map((valeur) => (
                  <ChoixChip
                    key={valeur}
                    type="radio"
                    name="difficulte"
                    value={valeur}
                    label={valeur}
                    ariaLabel={`Difficulté ${valeur} sur 10`}
                    checked={difficulte === valeur}
                    onChange={() => setDifficulte(valeur)}
                  />
                ))}
              </div>
              <ErreursChamp id="difficulte-erreur" errors={errors.difficulte} />
            </div>
          </fieldset>

          <div className="space-y-3 py-6 first:pt-0 last:pb-0">
            <Label htmlFor="commentaire" className="text-base font-semibold">
              Commentaire
              <span className="text-caption font-normal text-muted-foreground">(facultatif)</span>
            </Label>
            <Textarea
              id="commentaire"
              name="commentaire"
              value={commentaire}
              onChange={(event) => setCommentaire(event.target.value)}
              maxLength={COMMENTAIRE_MAX}
              placeholder="Ce qui a bien marché, ce qui a été difficile…"
              aria-describedby={errors.commentaire?.length ? "commentaire-erreur" : undefined}
              aria-invalid={errors.commentaire?.length ? true : undefined}
            />
            <ErreursChamp id="commentaire-erreur" errors={errors.commentaire} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-4">
        {hasClientErrors || (state.status === "error" && state.message) ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>
              {hasClientErrors
                ? "Auto-évaluation non enregistrée : corrigez les champs signalés."
                : state.message}
            </AlertDescription>
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
            "Enregistrer"
          )}
        </Button>
      </div>
    </form>
  );
}
