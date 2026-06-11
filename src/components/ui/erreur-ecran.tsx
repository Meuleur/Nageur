"use client";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * État d'erreur générique (B4) — utilisé par les error.tsx des groupes de
 * routes : message neutre en français, action « Réessayer » (reset de la
 * frontière). Aucun détail technique affiché.
 */
export function ErreurEcran({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <Alert variant="destructive">
        <AlertCircle aria-hidden />
        <AlertDescription>
          Une erreur est survenue pendant le chargement de cet écran. Vos données n&apos;ont pas été
          modifiées.
        </AlertDescription>
      </Alert>
      <Button onClick={reset} variant="outline">
        Réessayer
      </Button>
    </main>
  );
}
