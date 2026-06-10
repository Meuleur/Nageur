"use client";

import { Check, X } from "lucide-react";

import {
  countPasswordCategories,
  evaluatePasswordStrength,
  isCommonPassword,
  PASSWORD_MIN_CATEGORIES,
  PASSWORD_MIN_LENGTH,
} from "@/features/auth/password";
import { cn } from "@/lib/utils";

const LEVEL_BAR_CLASSES = [
  "bg-status-refused",
  "bg-status-pending",
  "bg-primary",
  "bg-status-valid",
] as const;

function Requirement({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? Check : X;
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 text-caption",
        ok ? "text-status-valid-text" : "text-muted-foreground",
      )}
    >
      {/* Icône + texte : l'état n'est jamais porté par la seule couleur (B4). */}
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/**
 * Indicateur de robustesse à la saisie (C1, E-01/E-04) : jauge + exigences
 * de la politique ADR-018, annoncés aux lecteurs d'écran via aria-live.
 */
export function PasswordStrength({ password }: { password: string }) {
  if (password.length === 0) {
    return null;
  }
  const strength = evaluatePasswordStrength(password);
  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  const enoughCategories = countPasswordCategories(password) >= PASSWORD_MIN_CATEGORIES;
  const notCommon = !isCommonPassword(password);

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((segment) => (
            <span
              key={segment}
              className={cn(
                "h-1.5 flex-1 rounded-full bg-border transition-colors duration-200",
                segment <= strength.level && LEVEL_BAR_CLASSES[strength.level],
              )}
            />
          ))}
        </div>
        <span className="text-caption text-muted-foreground">
          Robustesse&nbsp;: {strength.label}
        </span>
      </div>
      <ul className="space-y-1">
        <Requirement ok={longEnough}>Au moins {PASSWORD_MIN_LENGTH} caractères</Requirement>
        <Requirement ok={enoughCategories}>
          Au moins {PASSWORD_MIN_CATEGORIES} catégories (minuscules, majuscules, chiffres, symboles)
        </Requirement>
        <Requirement ok={notCommon}>Pas un mot de passe courant</Requirement>
      </ul>
    </div>
  );
}
