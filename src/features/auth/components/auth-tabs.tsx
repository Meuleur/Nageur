import Link from "next/link";

import { cn } from "@/lib/utils";

/** Bascule Connexion ↔ Inscription (E-01). */
export function AuthTabs({ active }: { active: "connexion" | "inscription" }) {
  const tabs = [
    { key: "connexion", href: "/connexion", label: "Connexion" },
    { key: "inscription", href: "/inscription", label: "Inscription" },
  ] as const;

  return (
    <nav
      className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1"
      aria-label="Connexion ou inscription"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "flex h-9 items-center justify-center rounded-sm text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
