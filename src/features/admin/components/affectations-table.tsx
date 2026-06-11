"use client";

import { useActionState, useId, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { affecterCoachAction } from "../actions";
import { ADMIN_FORM_IDLE } from "../form-state";
import type { CoachAdmin, NageurAffectation } from "@/server/data/admin";

/** Une ligne = un nageur + son formulaire d'affectation (PA-4). */
function LigneNageur({ nageur, coachs }: { nageur: NageurAffectation; coachs: CoachAdmin[] }) {
  const [state, formAction, isPending] = useActionState(affecterCoachAction, ADMIN_FORM_IDLE);
  // Sélection contrôlée : survit au reset automatique des formulaires
  // (React 19) et n'écrase pas le choix après l'aller-retour serveur.
  const [coachId, setCoachId] = useState(nageur.coachId ?? "");
  const selectId = useId();

  const inchangee = coachId === (nageur.coachId ?? "");

  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {nageur.prenom} {nageur.nom}
          </p>
          <p className="text-caption text-muted-foreground">{nageur.email}</p>
        </div>
        {nageur.coachId === null ? (
          <Badge variant="pending">Sans coach</Badge>
        ) : (
          <Badge variant="valid">Avec coach</Badge>
        )}
      </div>

      <form
        action={formAction}
        onReset={(event) => event.preventDefault()}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="nageur_id" value={nageur.id} />
        <Label htmlFor={selectId} className="sr-only">
          Coach de {nageur.prenom} {nageur.nom}
        </Label>
        <select
          id={selectId}
          name="coach_id"
          value={coachId}
          onChange={(event) => setCoachId(event.target.value)}
          className="h-11 w-full min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-72"
        >
          <option value="">Sans coach</option>
          {coachs.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.prenom} {coach.nom}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="outline"
          disabled={isPending || inchangee}
          aria-busy={isPending}
        >
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Enregistrer
        </Button>
      </form>

      {state.status === "success" ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </li>
  );
}

/**
 * E-32 — Affectations coach ↔ nageur (PA-4, RG-10 à RG-15) : liste complète
 * des nageurs avec recherche côté client ; chaque ligne affecte, réaffecte
 * ou désaffecte (« Sans coach », RG-13). La réaffectation conserve les
 * séances existantes (RG-15, garanti par le modèle).
 */
export function AffectationsTable({
  nageurs,
  coachs,
}: {
  nageurs: NageurAffectation[];
  coachs: CoachAdmin[];
}) {
  const [recherche, setRecherche] = useState("");
  const [filtreSansCoach, setFiltreSansCoach] = useState(false);

  const besoin = recherche.trim().toLowerCase();
  const visibles = nageurs.filter((nageur) => {
    if (filtreSansCoach && nageur.coachId !== null) {
      return false;
    }
    if (besoin === "") {
      return true;
    }
    return `${nageur.prenom} ${nageur.nom} ${nageur.email}`.toLowerCase().includes(besoin);
  });

  return (
    <section aria-label="Affectations" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher un nageur (nom ou e-mail)…"
            aria-label="Rechercher un nageur"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filtreSansCoach}
            onChange={(event) => setFiltreSansCoach(event.target.checked)}
            className="size-4 accent-primary"
          />
          Sans coach uniquement
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Aucun nageur ne correspond à cette recherche.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((nageur) => (
            <LigneNageur key={nageur.id} nageur={nageur} coachs={coachs} />
          ))}
        </ul>
      )}
    </section>
  );
}
