"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Home,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListChecks,
  Sparkles,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { LogoutButton } from "@/features/auth/components/logout-button";
import { cn } from "@/lib/utils";

type ElementNav = { href: string; label: string; icone: LucideIcon };
type RoleNav = "nageur" | "coach" | "admin";

/**
 * Navigation adaptative (B4) : barre latérale ≥ 1024 px, barre inférieure en
 * dessous. Un seul des deux menus est visible à la fois (l'autre est en
 * display:none), libellés identiques des deux côtés.
 */
const NAV_ITEMS: Record<RoleNav, ElementNav[]> = {
  nageur: [
    { href: "/accueil", label: "Accueil", icone: Home },
    { href: "/seances", label: "Mes séances", icone: ListChecks },
    { href: "/seances/generer", label: "Générer une séance", icone: Sparkles },
    { href: "/profil", label: "Mon profil", icone: ClipboardList },
  ],
  coach: [
    { href: "/coach", label: "Tableau de bord", icone: LayoutDashboard },
    { href: "/coach/seances", label: "Séances à valider", icone: ListChecks },
    { href: "/coach/nageurs", label: "Mes nageurs", icone: Users },
  ],
  admin: [
    { href: "/admin", label: "Tableau de bord", icone: LayoutDashboard },
    { href: "/admin/fournisseurs", label: "Fournisseurs LLM", icone: KeyRound },
    { href: "/admin/affectations", label: "Affectations", icone: Link2 },
    { href: "/admin/coachs", label: "Coachs", icone: Users },
  ],
};

const SOUS_TITRES: Record<RoleNav, string> = {
  nageur: "Espace nageur",
  coach: "Espace coach",
  admin: "Administration",
};

/** L'élément actif est celui dont le href est le plus long préfixe du chemin. */
function hrefActif(items: ElementNav[], pathname: string): string | null {
  let actif: string | null = null;
  for (const { href } of items) {
    const correspond = pathname === href || pathname.startsWith(`${href}/`);
    if (correspond && (actif === null || href.length > actif.length)) {
      actif = href;
    }
  }
  return actif;
}

function Marque({ sousTitre }: { sousTitre: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary-soft">
        <Waves className="size-5 text-primary-hover" aria-hidden />
      </span>
      <span>
        <span className="block text-sm leading-tight font-semibold">App Natation</span>
        <span className="block text-caption leading-tight text-muted-foreground">{sousTitre}</span>
      </span>
    </div>
  );
}

export function AppShell({ role, children }: { role: RoleNav; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];
  const actif = hrefActif(items, pathname);

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Barre latérale — desktop uniquement. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
        <div className="px-2">
          <Marque sousTitre={SOUS_TITRES[role]} />
        </div>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1">
          {items.map(({ href, label, icone: Icone }) => (
            <Link
              key={href}
              href={href}
              aria-current={actif === href ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                actif === href
                  ? "bg-primary-soft text-primary-hover"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icone className="size-5 shrink-0" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>

      {/* En-tête mobile/tablette : marque + déconnexion. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b bg-card px-4 py-2 lg:hidden">
        <Marque sousTitre={SOUS_TITRES[role]} />
        <LogoutButton />
      </header>

      {/* Contenu — dégagé de la barre latérale (desktop) et de la barre
          inférieure (mobile). */}
      <div className="flex flex-1 flex-col pb-24 lg:pb-0 lg:pl-60">{children}</div>

      {/* Barre inférieure — mobile/tablette uniquement. */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex">
          {items.map(({ href, label, icone: Icone }) => (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={actif === href ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-[11px] leading-tight font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  actif === href
                    ? "text-primary-hover"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icone className="size-5 shrink-0" aria-hidden />
                <span className="max-w-full">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
