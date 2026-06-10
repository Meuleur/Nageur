"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { createBareAnonClient } from "@/lib/supabase/anon-server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createSessionClient } from "@/lib/supabase/session";
import { logAuthEvent } from "@/server/auth/audit";
import {
  clearPending2faCookie,
  clearResetCookie,
  readPending2fa,
  readResetToken,
  setPending2faCookie,
} from "@/server/auth/cookies";
import {
  consumeRateLimit,
  getRateLimitLockSeconds,
  RATE_LIMITS,
  resetRateLimit,
} from "@/server/auth/rate-limit";
import { establishVerifiedSession } from "@/server/auth/session";
import { buildOtpEmail } from "@/server/email/otp-email";
import { sendMail } from "@/server/email";
import { issueOtpCode, verifyOtpCode } from "@/server/otp";

import type { AuthFormState } from "./form-state";
import { ROLE_HOME } from "./routes";
import { emailOnlySchema, loginSchema, newPasswordSchema, otpSchema, signupSchema } from "./schemas";

/**
 * Actions serveur d'authentification (C1) — toutes les règles de sécurité
 * (gating du second facteur, limitation de débit, verrouillage, réponses
 * génériques) vivent ICI, côté serveur ; le client n'apporte que l'UX.
 * Aucun mot de passe, code OTP ou jeton n'est journalisé (C1/D3).
 * (Un fichier "use server" n'exporte que des fonctions async — l'état des
 * formulaires vit dans ./form-state.)
 */

const GENERIC_ERROR = "Une erreur est survenue. Réessayez dans un instant.";
const TOO_MANY_ATTEMPTS = "Trop de tentatives. Réessayez plus tard.";

/** IP cliente (Vercel/proxy : x-forwarded-for) — uniquement hachée ensuite. */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "ip-inconnue"
  );
}

function fieldErrors(error: z.ZodError): AuthFormState {
  return { status: "error", fieldErrors: z.flattenError(error).fieldErrors };
}

// ---------------------------------------------------------------------------
// Inscription (E-01, PN-1, RG-02, RG-04, RG-05)
// ---------------------------------------------------------------------------
export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    prenom: formData.get("prenom"),
    nom: formData.get("nom"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fieldErrors(parsed.error);
  }
  const { prenom, nom, email, password } = parsed.data;

  try {
    const rate = await consumeRateLimit("signup:ip", await clientIp(), RATE_LIMITS.signupByIp);
    if (!rate.allowed) {
      await logAuthEvent("auth.rate_limited", { metadata: { scope: "signup" } });
      return { status: "error", message: TOO_MANY_ATTEMPTS };
    }

    // RG-04 : un e-mail = un compte. B2 demande un message explicite sous le
    // champ (l'inscription révèle l'existence du compte ; la réinitialisation,
    // elle, reste générique — C1).
    const service = createServiceRoleClient();
    const { data: existing, error: existsError } = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existsError) {
      return { status: "error", message: GENERIC_ERROR };
    }
    if (existing) {
      return {
        status: "error",
        fieldErrors: {
          email: [
            "Cet e-mail est déjà utilisé. Connectez-vous — ou renvoyez l'e-mail de vérification si votre compte n'est pas encore vérifié.",
          ],
        },
      };
    }

    // Client sans persistance : l'inscription ne pose AUCUN cookie de session
    // (e-mail non vérifié → accès bloqué, RG-05). Le rôle nageur est fixé par
    // le trigger handle_new_user ; prenom/nom transitent par user_metadata.
    // GoTrue envoie l'e-mail de vérification via son SMTP (config.toml).
    const bare = createBareAnonClient();
    const { data, error } = await bare.auth.signUp({
      email,
      password,
      options: { data: { prenom, nom } },
    });
    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") {
        return { status: "error", fieldErrors: { email: ["Cet e-mail est déjà utilisé."] } };
      }
      if (error.code === "weak_password") {
        return { status: "error", fieldErrors: { password: ["Mot de passe trop faible."] } };
      }
      if (error.code === "over_email_send_rate_limit") {
        return { status: "error", message: "Patientez avant de demander un nouvel e-mail." };
      }
      return { status: "error", message: GENERIC_ERROR };
    }

    await logAuthEvent("auth.signup", { actorId: data.user?.id ?? null, metadata: { role: "nageur" } });
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect("/verification-email");
}

// ---------------------------------------------------------------------------
// Connexion — étape 1 : mot de passe (E-01, PN-2, RG-06)
// ---------------------------------------------------------------------------
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fieldErrors(parsed.error);
  }
  const { email, password } = parsed.data;
  let emailNotConfirmed = false;

  try {
    const ipRate = await consumeRateLimit("login:ip", await clientIp(), RATE_LIMITS.loginByIp);
    if (!ipRate.allowed) {
      await logAuthEvent("auth.rate_limited", { metadata: { scope: "login" } });
      return { status: "error", message: TOO_MANY_ATTEMPTS };
    }

    // Verrouillage temporaire (~10 échecs, ADR-018) : vérifié AVANT le mot de
    // passe — un compte verrouillé reçoit la même réponse quel que soit le
    // mot de passe soumis (pas d'oracle).
    const lockSeconds = await getRateLimitLockSeconds("login:echecs", email);
    if (lockSeconds) {
      await logAuthEvent("auth.login_locked");
      return { status: "error", message: TOO_MANY_ATTEMPTS };
    }

    // GATING C1, étape 1 : les identifiants sont vérifiés via un client SANS
    // persistance — la session issue du mot de passe ne quitte jamais cette
    // requête et son refresh token est révoqué immédiatement ci-dessous.
    const bare = createBareAnonClient();
    const { data, error } = await bare.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.code === "email_not_confirmed") {
        // RG-05 : compte existant mais non vérifié — on n'incrémente pas le
        // compteur d'échecs (le mot de passe n'est pas en cause).
        emailNotConfirmed = true;
      } else {
        // Seuls les VRAIS échecs d'identifiants alimentent le compteur de
        // verrouillage ; au-delà du plafond le verrou est posé (ADR-018).
        const failures = await consumeRateLimit(
          "login:echecs",
          email,
          RATE_LIMITS.loginFailuresByEmail,
        );
        await logAuthEvent("auth.login_failed", { metadata: { verrou: !failures.allowed } });
        if (!failures.allowed) {
          await logAuthEvent("auth.login_locked");
          return { status: "error", message: TOO_MANY_ATTEMPTS };
        }
        return { status: "error", message: "Identifiants invalides." };
      }
    }

    if (!emailNotConfirmed && data.session && data.user) {
      const service = createServiceRoleClient();

      // Révocation immédiate de la session « mot de passe seul » : il ne
      // reste côté GoTrue aucun jeton exploitable avant l'OTP (C1).
      await service.auth.admin.signOut(data.session.access_token, "local");

      // Le succès du premier facteur remet le compteur d'échecs à zéro.
      await resetRateLimit("login:echecs", email);

      // Second facteur : un seul code actif. Si un envoi date de moins de
      // 60 s (double soumission, reconnexion immédiate), on n'émet PAS de
      // nouveau code — l'ancien reste valable (ADR-018, anti-spam).
      const cooldown = await consumeRateLimit("otp:envoi", data.user.id, RATE_LIMITS.otpSendByUser);
      const hourly = cooldown.allowed
        ? await consumeRateLimit("otp:envoi-heure", data.user.id, RATE_LIMITS.otpSendHourlyByUser)
        : cooldown;
      if (cooldown.allowed && hourly.allowed) {
        const code = await issueOtpCode(data.user.id);
        try {
          await sendMail(buildOtpEmail(email, code));
        } catch {
          return {
            status: "error",
            message: "Impossible d'envoyer le code de connexion. Réessayez dans un instant.",
          };
        }
      }

      await setPending2faCookie(data.user.id, Date.now());
      await logAuthEvent("auth.login_password_ok", { actorId: data.user.id });
    }
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  if (emailNotConfirmed) {
    redirect("/verification-email?motif=non-verifie");
  }
  redirect("/verification-2fa");
}

// ---------------------------------------------------------------------------
// Connexion — étape 2 : code OTP (E-02, PN-2, RG-06 à RG-08)
// ---------------------------------------------------------------------------
export async function verifyOtpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  let destination: string | null = null;
  let pendingExpired = false;

  const parsed = otpSchema.safeParse({ code: formData.get("code") });

  try {
    const pending = await readPending2fa();
    if (!pending) {
      pendingExpired = true;
    } else if (!parsed.success) {
      return fieldErrors(parsed.error);
    } else {
      const ipRate = await consumeRateLimit("otp:verif-ip", await clientIp(), RATE_LIMITS.otpVerifyByIp);
      if (!ipRate.allowed) {
        await logAuthEvent("auth.rate_limited", { metadata: { scope: "otp-verif" } });
        return { status: "error", message: TOO_MANY_ATTEMPTS };
      }

      const result = await verifyOtpCode(pending.sub, parsed.data.code);

      if (result.status === "mismatch") {
        await logAuthEvent("auth.otp_failed", {
          actorId: pending.sub,
          metadata: { restantes: result.remainingAttempts },
        });
        return {
          status: "error",
          message:
            result.remainingAttempts === 1
              ? "Code erroné. Dernière tentative avant invalidation du code."
              : `Code erroné. Il vous reste ${result.remainingAttempts} tentatives.`,
          remainingAttempts: result.remainingAttempts,
        };
      }
      if (result.status === "locked") {
        await logAuthEvent("auth.otp_failed", { actorId: pending.sub, metadata: { verrou: true } });
        return {
          status: "error",
          message: "Trop de tentatives erronées : ce code est invalidé. Demandez un nouveau code.",
          remainingAttempts: 0,
        };
      }
      if (result.status === "expired") {
        return { status: "error", message: "Code expiré ou invalide. Demandez un nouveau code." };
      }

      // Code valide : l'adresse e-mail vient du compte (jamais du client).
      const service = createServiceRoleClient();
      const { data: userData, error: userError } = await service.auth.admin.getUserById(pending.sub);
      if (userError || !userData.user?.email) {
        return { status: "error", message: GENERIC_ERROR };
      }

      // GATING C1, étape 4 : SEULEMENT MAINTENANT la session navigateur est
      // établie (cookies via les helpers SSR) — l'utilisateur est pleinement
      // authentifié, la RLS s'applique à ses lectures.
      const role = await establishVerifiedSession(userData.user.email);
      await clearPending2faCookie();
      await logAuthEvent("auth.otp_verified", { actorId: pending.sub });
      destination = ROLE_HOME[role];
    }
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  if (pendingExpired || !destination) {
    redirect("/connexion?motif=session-2fa-expiree");
  }
  redirect(destination);
}

// ---------------------------------------------------------------------------
// Renvoi d'un code OTP (E-02, ADR-018 : 60 s entre deux envois)
// ---------------------------------------------------------------------------
export async function resendOtpAction(_prev: AuthFormState): Promise<AuthFormState> {
  let pendingExpired = false;

  try {
    const pending = await readPending2fa();
    if (!pending) {
      pendingExpired = true;
    } else {
      const cooldown = await consumeRateLimit("otp:envoi", pending.sub, RATE_LIMITS.otpSendByUser);
      if (!cooldown.allowed) {
        return {
          status: "error",
          message: `Un code vient d'être envoyé. Patientez ${cooldown.retryAfterSeconds ?? 60} s avant un nouvel envoi.`,
          resendAvailableInSeconds: cooldown.retryAfterSeconds,
        };
      }
      const hourly = await consumeRateLimit("otp:envoi-heure", pending.sub, RATE_LIMITS.otpSendHourlyByUser);
      if (!hourly.allowed) {
        await logAuthEvent("auth.rate_limited", { actorId: pending.sub, metadata: { scope: "otp-envoi" } });
        return { status: "error", message: TOO_MANY_ATTEMPTS };
      }

      const service = createServiceRoleClient();
      const { data: userData, error: userError } = await service.auth.admin.getUserById(pending.sub);
      if (userError || !userData.user?.email) {
        return { status: "error", message: GENERIC_ERROR };
      }

      const code = await issueOtpCode(pending.sub);
      await sendMail(buildOtpEmail(userData.user.email, code));
      const otpExpiresAt = await setPending2faCookie(pending.sub, pending.authAt);
      await logAuthEvent("auth.otp_resent", { actorId: pending.sub });
      return {
        status: "success",
        message: "Un nouveau code vient de vous être envoyé.",
        otpExpiresAt,
      };
    }
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect("/connexion?motif=session-2fa-expiree");
}

// ---------------------------------------------------------------------------
// Renvoi de l'e-mail de vérification (E-03, RG-05)
// ---------------------------------------------------------------------------
export async function resendVerificationAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fieldErrors(parsed.error);
  }

  // Réponse générique : ne révèle ni l'existence ni l'état du compte.
  const generic: AuthFormState = {
    status: "success",
    message:
      "Si un compte non vérifié existe pour cette adresse, l'e-mail de vérification vient d'être renvoyé.",
  };

  try {
    const rate = await consumeRateLimit(
      "verif:renvoi-ip",
      await clientIp(),
      RATE_LIMITS.verificationResendByIp,
    );
    if (!rate.allowed) {
      await logAuthEvent("auth.rate_limited", { metadata: { scope: "verif-renvoi" } });
      return generic;
    }
    const bare = createBareAnonClient();
    // Erreurs volontairement ignorées (déjà vérifié, compte inconnu,
    // fréquence GoTrue 60 s…) : la réponse reste générique.
    await bare.auth.resend({ type: "signup", email: parsed.data.email });
  } catch {
    // Réponse générique même en cas d'erreur interne.
  }
  return generic;
}

// ---------------------------------------------------------------------------
// Réinitialisation — demande (E-04, PN-2, RG-09)
// ---------------------------------------------------------------------------
export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fieldErrors(parsed.error);
  }

  // C1 : réponse identique que le compte existe ou non.
  const generic: AuthFormState = {
    status: "success",
    message:
      "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé (lien valable 1 heure).",
  };

  try {
    const ipRate = await consumeRateLimit("reset:ip", await clientIp(), RATE_LIMITS.resetByIp);
    const emailRate = await consumeRateLimit("reset:email", parsed.data.email, RATE_LIMITS.resetByEmail);
    if (!ipRate.allowed || !emailRate.allowed) {
      await logAuthEvent("auth.rate_limited", { metadata: { scope: "reset" } });
      return generic;
    }
    const bare = createBareAnonClient();
    // L'e-mail part via le SMTP de Supabase Auth (gabarit recovery →
    // /auth/confirm?type=recovery). Erreurs ignorées : réponse générique.
    await bare.auth.resetPasswordForEmail(parsed.data.email);
    await logAuthEvent("auth.password_reset_requested");
  } catch {
    // Réponse générique même en cas d'erreur interne.
  }
  return generic;
}

// ---------------------------------------------------------------------------
// Réinitialisation — nouveau mot de passe (E-04, RG-09, ADR-018)
// ---------------------------------------------------------------------------
export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let done = false;
  let linkExpired = false;

  try {
    const reset = await readResetToken();
    if (!reset) {
      linkExpired = true;
    } else {
      const parsed = newPasswordSchema.safeParse({
        password: formData.get("password"),
        confirmation: formData.get("confirmation"),
      });
      if (!parsed.success) {
        return fieldErrors(parsed.error);
      }

      const service = createServiceRoleClient();
      const { error } = await service.auth.admin.updateUserById(reset.sub, {
        password: parsed.data.password,
      });
      if (error) {
        return { status: "error", message: GENERIC_ERROR };
      }

      // ADR-018 : toutes les sessions actives sont invalidées après le
      // changement. Échec = erreur dure (on ne dégrade pas silencieusement
      // une exigence de sécurité) ; l'action est rejouable.
      const { error: revokeError } = await service.rpc("revoke_all_sessions", {
        target_user_id: reset.sub,
      });
      if (revokeError) {
        return { status: "error", message: GENERIC_ERROR };
      }

      await clearResetCookie();
      await logAuthEvent("auth.password_reset_completed", { actorId: reset.sub });
      done = true;
    }
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  if (linkExpired || !done) {
    redirect("/mot-de-passe-oublie?motif=lien-expire");
  }
  redirect("/connexion?motif=mot-de-passe-modifie");
}

// ---------------------------------------------------------------------------
// Déconnexion
// ---------------------------------------------------------------------------
export async function logoutAction(): Promise<void> {
  try {
    const session = await createSessionClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    // Révoque la session courante (refresh token) et efface les cookies.
    await session.auth.signOut({ scope: "local" });
    if (user) {
      await logAuthEvent("auth.logout", { actorId: user.id });
    }
  } catch {
    // La redirection vers la connexion reste le bon réflexe.
  }
  redirect("/connexion");
}
