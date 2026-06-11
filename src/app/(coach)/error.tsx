"use client";

import { ErreurEcran } from "@/components/ui/erreur-ecran";

/** Frontière d'erreur du groupe — état homogène avec action Réessayer (B4). */
export default function GroupeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErreurEcran reset={reset} />;
}
