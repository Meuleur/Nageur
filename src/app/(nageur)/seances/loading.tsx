import { SqueletteEcran } from "@/components/ui/squelette";

/**
 * État de chargement des écrans séances (B2/B4) : squelette homogène, annoncé
 * aux lecteurs d'écran. Sert de frontière Suspense pour /seances et ses
 * sous-routes (détail, auto-évaluation).
 */
export default function SeancesLoading() {
  return <SqueletteEcran />;
}
