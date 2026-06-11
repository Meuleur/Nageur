"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Pencil, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { traiterSeanceAction } from "../actions";
import { TRAITEMENT_FORM_IDLE } from "../form-state";
import { COMMENTAIRE_COACH_MAX, COMMENTAIRE_REFUS_REQUIS } from "../schemas";

/**
 * E-22 — décision du coach sur une séance en attente (PC-3, RG-26) : Valider
 * (T2) ou Refuser (T4) — le bouton soumis porte la décision ; « Modifier puis
 * valider » (T3) ouvre E-23. Commentaire partagé : facultatif à la
 * validation, obligatoire au refus (RG-29) — vérifié ici pour l'UX, et
 * revérifié côté serveur (D2). Formulaire contrôlé + onReset : les valeurs
 * survivent aux allers-retours de l'action serveur (React 19).
 */
export function TraitementActions({ seanceId }: { seanceId: string }) {
  const [state, formAction, isPending] = useActionState(
    traiterSeanceAction,
    TRAITEMENT_FORM_IDLE,
  );

  const [commentaire, setCommentaire] = useState("");
  const [erreurClient, setErreurClient] = useState<string | null>(null);

  // RG-29 côté client : bloque le refus sans commentaire avant l'aller-retour
  // serveur. La décision est portée par le bouton soumis (SubmitEvent).
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const declencheur = (event.nativeEvent as SubmitEvent).submitter;
    const decision = declencheur instanceof HTMLButtonElement ? declencheur.value : null;
    if (decision === "refuser" && commentaire.trim() === "") {
      event.preventDefault();
      setErreurClient(COMMENTAIRE_REFUS_REQUIS);
      return;
    }
    setErreurClient(null);
  };

  const erreurCommentaire = erreurClient ?? state.fieldErrors?.commentaire?.join(" ") ?? null;

  return (
    <form action={formAction} onSubmit={onSubmit} onReset={(event) => event.preventDefault()}>
      <input type="hidden" name="seance_id" value={seanceId} />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Votre décision</h2>
          </CardTitle>
          <CardDescription>
            Validez la séance telle quelle, modifiez-la avant de la valider, ou refusez-la. Le
            commentaire accompagne la séance côté nageur — il est obligatoire en cas de refus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="commentaire" className="text-base font-semibold">
              Commentaire pour le nageur
              <span className="text-caption font-normal text-muted-foreground">
                (obligatoire en cas de refus)
              </span>
            </Label>
            <Textarea
              id="commentaire"
              name="commentaire"
              value={commentaire}
              onChange={(event) => setCommentaire(event.target.value)}
              maxLength={COMMENTAIRE_COACH_MAX}
              placeholder="Un conseil, une adaptation, ou la raison du refus…"
              aria-describedby={erreurCommentaire ? "commentaire-erreur" : undefined}
              aria-invalid={erreurCommentaire ? true : undefined}
            />
            {erreurCommentaire ? (
              <p id="commentaire-erreur" className="text-caption text-status-refused-text">
                {erreurCommentaire}
              </p>
            ) : null}
          </div>

          {state.status === "error" && !state.fieldErrors?.commentaire?.length ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              name="decision"
              value="valider"
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              Valider la séance
            </Button>
            <Button asChild variant="outline" disabled={isPending}>
              <Link href={`/coach/seances/${seanceId}/modifier`}>
                <Pencil aria-hidden />
                Modifier puis valider
              </Link>
            </Button>
            <Button
              type="submit"
              name="decision"
              value="refuser"
              variant="destructive"
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
              Refuser
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
