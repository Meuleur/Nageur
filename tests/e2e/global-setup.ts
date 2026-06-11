import { execSync } from "node:child_process";

/**
 * Remise à zéro de l'état d'authentification volatile AVANT chaque suite
 * E2E, pour des exécutions répétables :
 *   - compteurs de rate limiting / verrous (auth_rate_limits) ;
 *   - codes OTP encore actifs (usage unique → on les invalide) ;
 *   - horodatage anti-spam des e-mails de récupération GoTrue (60 s).
 * Local uniquement : passe par le conteneur Postgres de `supabase start`.
 */
/** Comptes CH3 (profil) : repartent avec un profil sportif vierge (E-11). */
const PROFIL_E2E_EMAILS =
  "('mia.nageur@nageur.test','zoe.nageur@nageur.test','tom.nageur@nageur.test','theo.nageur@nageur.test')";

const SQL = [
  "truncate public.auth_rate_limits;",
  "update public.otp_codes set used = true where not used;",
  "update auth.users set recovery_sent_at = null where email like '%@nageur.test';",
  `delete from public.swimmer_availabilities where nageur_id in (select id from public.profiles where email in ${PROFIL_E2E_EMAILS});`,
  `delete from public.swimmer_profiles where nageur_id in (select id from public.profiles where email in ${PROFIL_E2E_EMAILS});`,
].join(" ");

export default function globalSetup() {
  try {
    execSync(`docker exec -i supabase_db_appNageur psql -U postgres -d postgres -c "${SQL}"`, {
      stdio: "pipe",
    });
  } catch {
    throw new Error(
      "Impossible de préparer la base locale pour les tests E2E. " +
        "La pile Supabase locale doit tourner : `pnpm supabase:start` (puis `pnpm db:reset` au besoin).",
    );
  }
}
