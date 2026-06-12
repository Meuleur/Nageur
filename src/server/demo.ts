import "server-only";

/**
 * Mode DÉMO (branche `demo` UNIQUEMENT — jamais mergé dans main) : active
 * les facilités de démonstration client (saut du second facteur, comptes
 * auto-confirmés à l'inscription, bannière DÉMO). Défaut : faux — chaque
 * chemin de contournement appelle cette garde en PREMIÈRE ligne et reste
 * inerte sans `DEMO_MODE=true`.
 */
export function estModeDemo(): boolean {
  return process.env.DEMO_MODE === "true";
}
