import { Card, CardContent } from "@/components/ui/card";

/**
 * État de chargement des écrans séances (B2/B4) : squelette sobre, annoncé
 * aux lecteurs d'écran. Sert de frontière Suspense pour /seances et ses
 * sous-routes (détail, auto-évaluation).
 */
export default function SeancesLoading() {
  return (
    <main
      aria-busy
      aria-label="Chargement"
      className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6"
    >
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      </div>
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardContent className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
