"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

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
 * Horloge à la seconde, exposée comme « store externe » : null au rendu
 * serveur et pendant l'hydratation (textes initiaux identiques des deux
 * côtés — pas de désynchronisation), puis la valeur réelle, re-rendue à
 * chaque tick.
 */
function subscribeToClock(onTick: () => void) {
  const interval = window.setInterval(onTick, 1000);
  return () => window.clearInterval(interval);
}

function useNow(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    // Arrondi à la seconde : l'instantané reste stable entre deux ticks.
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null,
  );
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

  // Réaction au résultat d'un renvoi — ajustement d'état PENDANT le rendu
  // (pattern React « adjusting state when props change », pas d'effet).
  // L'instant courant vient de l'horloge `now` (stable par rendu) : un
  // résultat d'action n'arrive qu'après hydratation, donc now est non nul.
  const [handledResendState, setHandledResendState] = useState(resendState);
  if (resendState !== handledResendState && now !== null) {
    setHandledResendState(resendState);
    if (resendState.otpExpiresAt) {
      setExpiresAt(resendState.otpExpiresAt);
    }
    if (resendState.status === "success") {
      setResendBlockedUntil(now + 60_000);
    } else if (resendState.resendAvailableInSeconds) {
      setResendBlockedUntil(now + resendState.resendAvailableInSeconds * 1000);
    }
  }

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
