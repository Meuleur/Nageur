import Link from "next/link";

import { LogoutButton } from "@/features/auth/components/logout-button";
import { cn } from "@/lib/utils";

/** Navigation de l'espace admin (E-30 à E-33) — sobre, responsive (B4). */
const ONGLETS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/fournisseurs", label: "Fournisseurs LLM" },
  { href: "/admin/affectations", label: "Affectations" },
  { href: "/admin/coachs", label: "Coachs" },
] as const;

export type OngletAdmin = (typeof ONGLETS)[number]["href"];

export function AdminEntete({
  actif,
  titre,
  description,
}: {
  actif: OngletAdmin;
  titre: string;
  description: string;
}) {
  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">{titre}</h1>
          <p className="text-caption text-muted-foreground">{description}</p>
        </div>
        <LogoutButton />
      </div>
      <nav aria-label="Espace administration" className="flex flex-wrap gap-2">
        {ONGLETS.map((onglet) => (
          <Link
            key={onglet.href}
            href={onglet.href}
            aria-current={onglet.href === actif ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              onglet.href === actif
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {onglet.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
