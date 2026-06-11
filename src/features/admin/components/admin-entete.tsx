/**
 * En-tête des écrans admin (E-30 à E-33) — titre + description. La navigation
 * entre onglets et la déconnexion sont portées par la coquille AppShell (CH9).
 */
export function AdminEntete({ titre, description }: { titre: string; description: string }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">{titre}</h1>
      <p className="text-caption text-muted-foreground">{description}</p>
    </header>
  );
}
