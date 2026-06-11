import Link from "next/link";
import { connection } from "next/server";
import { Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * 404 global — charte B4 (FR, sobre). Rendu dynamique imposé : la CSP à
 * nonce (proxy.ts) bloquerait les scripts inline d'une page prérendue.
 */
export default async function NotFound() {
  await connection();
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <Waves className="size-8 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Page introuvable</h1>
            <p className="text-sm text-muted-foreground">
              Cette page n&apos;existe pas ou n&apos;est plus disponible.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Retour à l&apos;application</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
