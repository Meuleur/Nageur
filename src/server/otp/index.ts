import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAuthSecret } from "@/server/env";

import {
  decideOtpAttempt,
  generateOtpCode,
  hashOtpCode,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  type OtpDecision,
} from "./logic";

/** Purge des codes expirés (C1) : on garde 24 h pour l'investigation. */
const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Émet un nouveau code OTP pour l'utilisateur : un seul code actif à la fois
 * (les précédents sont invalidés), stockage haché uniquement (C1).
 * Retourne le code EN CLAIR pour l'e-mail — ne jamais le journaliser.
 */
export async function issueOtpCode(userId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const code = generateOtpCode();
  const codeHash = hashOtpCode(getAuthSecret(), userId, code);

  // Purge opportuniste des codes morts depuis plus de 24 h (C1).
  await supabase
    .from("otp_codes")
    .delete()
    .lt("expires_at", new Date(Date.now() - PURGE_AFTER_MS).toISOString());

  // Usage unique par émission : tout code encore actif est invalidé.
  await supabase.from("otp_codes").update({ used: true }).eq("user_id", userId).eq("used", false);

  const { error } = await supabase.from("otp_codes").insert({
    user_id: userId,
    code_hash: codeHash,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) {
    throw new Error("otp_codes: émission impossible");
  }
  return code;
}

/**
 * Vérifie une saisie de code (RG-07) : expiration 10 min, 5 tentatives,
 * usage unique. La tentative est réservée par compare-and-swap sur
 * `attempts`, la consommation par compare-and-swap sur `used` : deux
 * vérifications concurrentes ne peuvent ni dépasser le plafond ni
 * consommer deux fois le même code.
 */
export async function verifyOtpCode(userId: string, code: string): Promise<OtpDecision> {
  const supabase = createServiceRoleClient();
  const candidateHash = hashOtpCode(getAuthSecret(), userId, code);

  const { data: record, error } = await supabase
    .from("otp_codes")
    .select("id, code_hash, expires_at, attempts, used")
    .eq("user_id", userId)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error("otp_codes: lecture impossible");
  }
  if (!record) {
    return { status: "expired" };
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return { status: "expired" };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { status: "locked" };
  }

  const { data: claimed } = await supabase
    .from("otp_codes")
    .update({ attempts: record.attempts + 1 })
    .eq("id", record.id)
    .eq("attempts", record.attempts)
    .eq("used", false)
    .select("attempts")
    .maybeSingle();
  if (!claimed) {
    // Course perdue contre une autre tentative : l'appelant redemandera.
    return { status: "expired" };
  }

  const decision = decideOtpAttempt({ ...record, attempts: claimed.attempts }, candidateHash, Date.now());
  if (decision.status !== "ok") {
    return decision;
  }

  const { data: consumed } = await supabase
    .from("otp_codes")
    .update({ used: true })
    .eq("id", record.id)
    .eq("used", false)
    .select("id")
    .maybeSingle();
  if (!consumed) {
    return { status: "expired" };
  }
  return { status: "ok" };
}
