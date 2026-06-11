"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Power, Stethoscope } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  activerFournisseurAction,
  definirCleApiAction,
  definirModeleAction,
  testerCleAction,
} from "../actions";
import { ADMIN_FORM_IDLE, type AdminFormState } from "../form-state";
import type { FournisseurAdmin } from "../schemas";

/** Modèles suggérés (liste ouverte : l'admin peut saisir tout identifiant). */
const MODELES_SUGGERES: Record<FournisseurAdmin, string[]> = {
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5", "claude-fable-5"],
  openai: ["gpt-4o", "gpt-4o-mini"],
};

const NOMS: Record<FournisseurAdmin, string> = { anthropic: "Anthropic", openai: "OpenAI" };

function RetourAction({ state }: { state: AdminFormState }) {
  if (state.status === "success") {
    return (
      <Alert variant="success">
        <CheckCircle2 aria-hidden />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  if (state.status === "error" && state.message) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

/**
 * E-31 — carte d'un fournisseur LLM (PA-3, RG-38, ADR-007) : rotation de
 * clé (saisie type password, jamais relue ni réaffichée), choix du modèle,
 * test de clé (appel minimal serveur) et activation exclusive. Formulaires
 * contrôlés + onReset (React 19).
 */
export function FournisseurCarte({
  fournisseur,
  modele,
  actif,
  cleEnregistree,
  majLe,
}: {
  fournisseur: FournisseurAdmin;
  modele: string | null;
  actif: boolean;
  cleEnregistree: boolean;
  majLe: string;
}) {
  const [etatCle, soumettreCle, cleEnCours] = useActionState(definirCleApiAction, ADMIN_FORM_IDLE);
  const [etatModele, soumettreModele, modeleEnCours] = useActionState(
    definirModeleAction,
    ADMIN_FORM_IDLE,
  );
  const [etatTest, soumettreTest, testEnCours] = useActionState(testerCleAction, ADMIN_FORM_IDLE);
  const [etatActivation, soumettreActivation, activationEnCours] = useActionState(
    activerFournisseurAction,
    ADMIN_FORM_IDLE,
  );

  const [cle, setCle] = useState("");
  const [modeleSaisi, setModeleSaisi] = useState(modele ?? "");

  const erreurCle = etatCle.fieldErrors?.cle?.join(" ");
  const erreurModele = etatModele.fieldErrors?.modele?.join(" ");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>
            <h2>{NOMS[fournisseur]}</h2>
          </CardTitle>
          {actif ? (
            <Badge variant="valid">Fournisseur actif</Badge>
          ) : (
            <Badge variant="outline">Inactif</Badge>
          )}
        </div>
        <CardDescription>
          {cleEnregistree
            ? `Une clé est enregistrée (chiffrée, jamais réaffichée). Dernière mise à jour : ${new Date(majLe).toLocaleDateString("fr-FR")}.`
            : "Aucune clé enregistrée : ce fournisseur ne peut pas générer de séance."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rotation de clé (ADR-007) */}
        <form
          action={soumettreCle}
          onReset={(event) => event.preventDefault()}
          className="space-y-3"
        >
          <input type="hidden" name="fournisseur" value={fournisseur} />
          <Label htmlFor={`cle-${fournisseur}`} className="text-base font-semibold">
            {cleEnregistree ? "Remplacer la clé API" : "Enregistrer une clé API"}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={`cle-${fournisseur}`}
              name="cle"
              type="password"
              autoComplete="off"
              value={cle}
              onChange={(event) => setCle(event.target.value)}
              placeholder={fournisseur === "anthropic" ? "sk-ant-…" : "sk-…"}
              aria-invalid={erreurCle ? true : undefined}
              aria-describedby={erreurCle ? `cle-${fournisseur}-erreur` : undefined}
            />
            <Button type="submit" disabled={cleEnCours || cle.trim() === ""} aria-busy={cleEnCours}>
              {cleEnCours ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
              Enregistrer
            </Button>
          </div>
          {erreurCle ? (
            <p id={`cle-${fournisseur}-erreur`} className="text-caption text-status-refused-text">
              {erreurCle}
            </p>
          ) : null}
          <RetourAction state={etatCle} />
        </form>

        {/* Choix du modèle (C4) */}
        <form
          action={soumettreModele}
          onReset={(event) => event.preventDefault()}
          className="space-y-3"
        >
          <input type="hidden" name="fournisseur" value={fournisseur} />
          <Label htmlFor={`modele-${fournisseur}`} className="text-base font-semibold">
            Modèle
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={`modele-${fournisseur}`}
              name="modele"
              list={`modeles-${fournisseur}`}
              value={modeleSaisi}
              onChange={(event) => setModeleSaisi(event.target.value)}
              placeholder="Identifiant du modèle"
              aria-invalid={erreurModele ? true : undefined}
              aria-describedby={erreurModele ? `modele-${fournisseur}-erreur` : undefined}
            />
            <datalist id={`modeles-${fournisseur}`}>
              {MODELES_SUGGERES[fournisseur].map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <Button type="submit" variant="outline" disabled={modeleEnCours} aria-busy={modeleEnCours}>
              {modeleEnCours ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Enregistrer le modèle
            </Button>
          </div>
          {fournisseur === "anthropic" ? (
            <p className="text-caption text-muted-foreground">
              Les modèles Opus 4.7+ et Fable n&apos;acceptent pas de température : l&apos;application
              l&apos;omet automatiquement pour eux (ADR-025).
            </p>
          ) : null}
          {erreurModele ? (
            <p id={`modele-${fournisseur}-erreur`} className="text-caption text-status-refused-text">
              {erreurModele}
            </p>
          ) : null}
          <RetourAction state={etatModele} />
        </form>

        {/* Test de clé + activation (RG-38) */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <form action={soumettreTest}>
              <input type="hidden" name="fournisseur" value={fournisseur} />
              <Button type="submit" variant="outline" disabled={testEnCours} aria-busy={testEnCours}>
                {testEnCours ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Stethoscope aria-hidden />
                )}
                Tester la clé
              </Button>
            </form>
            {actif ? null : (
              <form action={soumettreActivation}>
                <input type="hidden" name="fournisseur" value={fournisseur} />
                <Button type="submit" disabled={activationEnCours} aria-busy={activationEnCours}>
                  {activationEnCours ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Power aria-hidden />
                  )}
                  Activer ce fournisseur
                </Button>
              </form>
            )}
          </div>
          <RetourAction state={etatTest} />
          <RetourAction state={etatActivation} />
        </div>
      </CardContent>
    </Card>
  );
}
