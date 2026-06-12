import "server-only";

import { createHmac } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAuthSecret } from "@/server/env";

import { decideRateLimit, type RateLimitDecision, type RateLimitPolicy } from "./rate-limit-logic";

// Politiques (C1/ADR-027) déclarées dans le module pur, testable unitairement.
export { RATE_LIMITS } from "./rate-limit-logic";

/**
 * Clé de compteur : HMAC(scope:identifiant) — ni adresse e-mail ni IP en
 * clair en base (E2/D3), tout en restant déterministe pour compter.
 */
function bucketKey(scope: string, identifier: string): string {
  return createHmac("sha256", `${getAuthSecret()}:rate-limit`)
    .update(`${scope}:${identifier.toLowerCase()}`)
    .digest("hex");
}

/**
 * Consomme une action limitée. Lecture → décision pure → écriture : deux
 * requêtes simultanées peuvent perdre un incrément, acceptable pour de la
 * limitation de débit. Toute erreur de stockage remonte (l'appelant répond
 * alors par une erreur générique : on ne désactive pas silencieusement une
 * mesure de sécurité).
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  policy: RateLimitPolicy,
): Promise<RateLimitDecision> {
  const supabase = createServiceRoleClient();
  const bucket = bucketKey(scope, identifier);

  const { data: row, error: readError } = await supabase
    .from("auth_rate_limits")
    .select("count, window_start, locked_until")
    .eq("bucket", bucket)
    .maybeSingle();
  if (readError) {
    throw new Error(`auth_rate_limits: lecture impossible (${scope})`);
  }

  const decision = decideRateLimit(
    row
      ? {
          count: row.count,
          windowStart: new Date(row.window_start).getTime(),
          lockedUntil: row.locked_until ? new Date(row.locked_until).getTime() : null,
        }
      : null,
    Date.now(),
    policy,
  );

  const { error: writeError } = await supabase.from("auth_rate_limits").upsert({
    bucket,
    count: decision.state.count,
    window_start: new Date(decision.state.windowStart).toISOString(),
    locked_until: decision.state.lockedUntil
      ? new Date(decision.state.lockedUntil).toISOString()
      : null,
  });
  if (writeError) {
    throw new Error(`auth_rate_limits: écriture impossible (${scope})`);
  }

  return decision;
}

/** Remise à zéro d'un compteur (ex. : échecs de connexion après succès). */
export async function resetRateLimit(scope: string, identifier: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("auth_rate_limits").delete().eq("bucket", bucketKey(scope, identifier));
}

/**
 * Lecture seule du verrou (sans consommer d'action) : un compte verrouillé
 * (~10 échecs, ADR-018) est refusé AVANT toute vérification de mot de passe
 * — même réponse pour un bon ou un mauvais mot de passe (pas d'oracle).
 * Retourne le délai restant en secondes, ou null si non verrouillé.
 */
export async function getRateLimitLockSeconds(
  scope: string,
  identifier: string,
): Promise<number | null> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("auth_rate_limits")
    .select("locked_until")
    .eq("bucket", bucketKey(scope, identifier))
    .maybeSingle();
  if (error) {
    throw new Error(`auth_rate_limits: lecture impossible (${scope})`);
  }
  if (!row?.locked_until) {
    return null;
  }
  const remainingMs = new Date(row.locked_until).getTime() - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : null;
}
