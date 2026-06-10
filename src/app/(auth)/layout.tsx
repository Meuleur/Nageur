import { Waves } from "lucide-react";

/**
 * Gabarit des écrans d'authentification (E-01 à E-04) : carte centrée,
 * pleine largeur sur mobile (B2), charte B4.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-md bg-primary-soft text-primary-hover">
            <Waves className="size-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">App Natation</h1>
            <p className="text-caption text-muted-foreground">
              Des séances générées par IA, validées par votre coach.
            </p>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
