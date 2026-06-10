"use client";

import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resendOtpAction, verifyOtpAction } from "@/features/auth/actions";
import { AUTH_FORM_IDLE } from "@/features/auth/form-state";
import { otpSchema } from "@/features/auth/schemas";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";
import { useClientValidation } from "./use-client-validation";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Horloge démarrée APRÈS montage (null au rendu serveur et au premier rendu
 * client) : le texte initial reste identique des deux côtés — pas de
 * désynchronisation d'hydratation pour un compte à rebours.
 */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

/**
 * E-02 — Saisie du code OTP (RG-06/RG-07) : compte à rebours d'expiration,
 * tentatives restantes, renvoi possible après 60 s (ADR-018).
 */
export function OtpForm({ initialExpiresAt }: { initialExpiresAt: number }) {
  const [verifyState, verifyAction] = useActionState(verifyOtpAction, AUTH_FORM_IDLE);
  const [resendState, resendAction] = useActionState(resendOtpAction, AUTH_FORM_IDLE);
  const { clientErrors, onSubmit } = useClientValidation(otpSchema);
  const now = useNow();

  // Échéance courante : prolongée quand un renvoi aboutit.
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  // Anti-spam de renvoi, côté affichage (le serveur fait foi).
  const [resendBlockedUntil, setResendBlockedUntil] = useState(() => Date.now() + 60_000);

  useEffect(() => {
    if (resendState.otpExpiresAt) {
      setExpiresAt(resendState.otpExpiresAt);
    }
    if (resendState.status === "success") {
      setResendBlockedUntil(Date.now() + 60_000);
    } else if (resendState.resendAvailableInSeconds) {
      setResendBlockedUntil(Date.now() + resendState.resendAvailableInSeconds * 1000);
    }
  }, [resendState]);

  const errors = { ...verifyState.fieldErrors, ...clientErrors };
  const remainingMs = now === null ? null : expiresAt - now;
  const expired = remainingMs !== null && remainingMs <= 0;
  const resendWaitSeconds =
    now === null ? 60 : Math.max(0, Math.ceil((resendBlockedUntil - now) / 1000));

  return (
    <div className="space-y-4">
      {verifyState.status === "error" && verifyState.message ? (
        <Alert variant="destructive">
          <AlertDescription>{verifyState.message}</AlertDescription>
        </Alert>
      ) : null}
      {resendState.status !== "idle" && resendState.message ? (
        <Alert variant={resendState.status === "success" ? "success" : "destructive"}>
          <AlertDescription>{resendState.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={verifyAction} onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          label="Code reçu par e-mail"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          className="text-center text-2xl tracking-[0.5em] font-mono"
          errors={errors.code}
        />
        <p className="text-caption text-muted-foreground" aria-live="polite">
          {remainingMs === null
            ? "Code valable 10 minutes."
            : expired
              ? "Le code a expiré : demandez un nouveau code ci-dessous."
              : `Code valable encore ${formatRemaining(remainingMs)}.`}
        </p>
        <SubmitButton pendingLabel="Vérification…">Valider</SubmitButton>
      </form>

      <form action={resendAction} className="text-center">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={resendWaitSeconds > 0}
          aria-live="polite"
        >
          {resendWaitSeconds > 0
            ? `Renvoyer un code (disponible dans ${resendWaitSeconds} s)`
            : "Renvoyer un code"}
        </Button>
      </form>
    </div>
  );
}
