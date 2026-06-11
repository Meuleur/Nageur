import { Card, CardContent } from "@/components/ui/card";

/**
 * Squelette d'écran générique (B4) — état de chargement homogène des
 * frontières Suspense (loading.tsx). Annoncé aux lecteurs d'écran.
 */
export function SqueletteEcran({ large = false }: { large?: boolean }) {
  return (
    <main
      aria-busy
      aria-label="Chargement"
      className={`mx-auto w-full flex-1 space-y-6 px-4 py-10 sm:px-6 ${large ? "max-w-5xl" : "max-w-3xl"}`}
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
