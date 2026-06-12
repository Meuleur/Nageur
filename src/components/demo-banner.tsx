import { estModeDemo } from "@/server/demo";

/**
 * Bandeau DÉMO (branche demo) — visible sur TOUTES les pages quand
 * `DEMO_MODE=true`, invisible sinon (la garde rend le composant inerte).
 * B4 : fond primary-strong / texte primary-foreground (contraste AA,
 * ADR-026) — discret mais impossible à confondre avec la production.
 */
export function DemoBanner() {
  if (!estModeDemo()) {
    return null;
  }
  return (
    <div
      data-slot="demo-banner"
      role="status"
      className="bg-primary-strong px-4 py-2 text-center text-sm font-medium text-primary-foreground"
    >
      DÉMO — 2FA désactivée, IA simulée, données fictives. Ne pas utiliser en production.
    </div>
  );
}
