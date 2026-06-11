"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { genererSeanceAction } from "../actions";
import { GENERATION_FORM_IDLE } from "../form-state";

/**
 * E-12 — déclencheur de génération (PN-5). État de chargement explicite
 * (B2) : indicateur + bouton désactivé pendant tout l'appel serveur. En cas
 * d'échec LLM, le message s'affiche et le même bouton sert de relance
 * (RG-23/RG-24). Les préconditions sont déjà vérifiées par la page ; si
 * elles tombent entre-temps (course), l'erreur renvoie vers E-10/E-11 (B2).
 */
export function GenererForm() {
  const [state, formAction, isPending] = useActionState(
    genererSeanceAction,
    GENERATION_FORM_IDLE,
  );

  const renvoi =
    state.code === "nageur_sans_coach" ? (
      <Link href="/accueil">Retour à l&apos;accueil</Link>
    ) : state.code === "profil_incomplet" ? (
      <Link href="/profil">Compléter mon profil</Link>
    ) : null;

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            {state.message}
            {renvoi ? <> {renvoi}</> : null}
            {state.relancePossible ? <> Vous pouvez relancer la génération.</> : null}
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
            Génération en cours…
          </>
        ) : (
          <>
            <Sparkles aria-hidden />
            {state.status === "error" && state.relancePossible
              ? "Relancer la génération"
              : "Générer ma séance"}
          </>
        )}
      </Button>

      {isPending ? (
        <p role="status" className="text-caption text-muted-foreground">
          Votre séance est en cours de génération — cela peut prendre jusqu&apos;à une minute.
        </p>
      ) : null}
    </form>
  );
}
