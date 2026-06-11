"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MailPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { inviterCoachAction } from "../actions";
import { ADMIN_FORM_IDLE } from "../form-state";

/**
 * E-33 — Invitation d'un coach (PA-5, RG-02) : l'admin saisit identité et
 * adresse, le coach définit SON mot de passe via le lien reçu (C4 — l'admin
 * ne manipule jamais de mot de passe). Formulaire contrôlé + onReset
 * (React 19) ; champs vidés uniquement après un succès.
 */
export function InvitationCoachForm() {
  const [state, formAction, isPending] = useActionState(inviterCoachAction, ADMIN_FORM_IDLE);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [dernierSucces, setDernierSucces] = useState<string | undefined>(undefined);

  // « Adjust state during render » (React 19) : on vide les champs à la
  // transition vers un nouveau succès, sans effet ni double rendu visible.
  if (state.status === "success" && state.message !== dernierSucces) {
    setDernierSucces(state.message);
    setPrenom("");
    setNom("");
    setEmail("");
  }

  const erreur = (champ: "prenom" | "nom" | "email") => state.fieldErrors?.[champ]?.join(" ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Inviter un coach</h2>
        </CardTitle>
        <CardDescription>
          Un e-mail d&apos;invitation lui sera envoyé : il définira son mot de passe puis se
          connectera normalement (avec code de confirmation, comme tout le monde).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} onReset={(event) => event.preventDefault()} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invitation-prenom">Prénom</Label>
              <Input
                id="invitation-prenom"
                name="prenom"
                value={prenom}
                onChange={(event) => setPrenom(event.target.value)}
                maxLength={50}
                autoComplete="off"
                aria-invalid={erreur("prenom") ? true : undefined}
              />
              {erreur("prenom") ? (
                <p className="text-caption text-status-refused-text">{erreur("prenom")}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitation-nom">Nom</Label>
              <Input
                id="invitation-nom"
                name="nom"
                value={nom}
                onChange={(event) => setNom(event.target.value)}
                maxLength={50}
                autoComplete="off"
                aria-invalid={erreur("nom") ? true : undefined}
              />
              {erreur("nom") ? (
                <p className="text-caption text-status-refused-text">{erreur("nom")}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invitation-email">Adresse e-mail</Label>
            <Input
              id="invitation-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              aria-invalid={erreur("email") ? true : undefined}
            />
            {erreur("email") ? (
              <p className="text-caption text-status-refused-text">{erreur("email")}</p>
            ) : null}
          </div>

          {state.status === "success" ? (
            <Alert variant="success">
              <CheckCircle2 aria-hidden />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "error" && state.message ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <MailPlus aria-hidden />
            )}
            Envoyer l&apos;invitation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
