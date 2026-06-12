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

/**
 * Comptes CH5 « génération » et CH10 « garde-fou » (ADR-027) : aucune séance
 * seedée — tout est généré par les tests (le truncate d'auth_rate_limits
 * ci-dessous remet aussi la fenêtre du garde-fou à zéro).
 */
const GENERATION_E2E_EMAILS =
  "('ines.nageur@nageur.test','eva.nageur@nageur.test','rayan.nageur@nageur.test','elsa.nageur@nageur.test')";

/** Comptes CH5 « refus → régénération » : on ne garde que la séance refusée seedée. */
const REGENERATION_E2E_EMAILS = "('mael.nageur@nageur.test','yanis.nageur@nageur.test')";

/** Comptes CH5 « détail + auto-évaluation » : auto-évaluation recréée par les tests. */
const DETAIL_E2E_EMAILS = "('louis.nageur@nageur.test','hugo.nageur@nageur.test')";

const SQL = [
  "truncate public.auth_rate_limits;",
  "update public.otp_codes set used = true where not used;",
  "update auth.users set recovery_sent_at = null where email like '%@nageur.test';",
  `delete from public.swimmer_availabilities where nageur_id in (select id from public.profiles where email in ${PROFIL_E2E_EMAILS});`,
  `delete from public.swimmer_profiles where nageur_id in (select id from public.profiles where email in ${PROFIL_E2E_EMAILS});`,
  `delete from public.seances where nageur_id in (select id from public.profiles where email in ${GENERATION_E2E_EMAILS});`,
  `delete from public.seances where statut = 'en_attente' and nageur_id in (select id from public.profiles where email in ${REGENERATION_E2E_EMAILS});`,
  `delete from public.auto_evaluations where nageur_id in (select id from public.profiles where email in ${DETAIL_E2E_EMAILS});`,
  // Comptes CH6 « coach » : les séances consommées (valider / modifier /
  // refuser) sont supprimées et réinsérées en_attente — un UPDATE de retour
  // est impossible, les statuts terminaux sont protégés par trigger (RG-30).
  "select public.reseed_ch6_e2e();",
  // Comptes CH8 « admin » : affectations E2E remises à « sans coach »,
  // coachs invités supprimés, fournisseurs LLM remis à l'état seed.
  "select public.reseed_ch8_e2e();",
  // Comptes dynamiques (inscription CH2, parcours CH9) : purgés pour éviter
  // l'accumulation entre exécutions.
  "select public.reseed_ch9_e2e();",
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
