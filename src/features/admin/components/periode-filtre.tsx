import Link from "next/link";

import { cn } from "@/lib/utils";
import { PERIODE_LABELS, PERIODES, type Periode } from "../periodes";

/** Filtre de période (E-30, C4) — fenêtres glissantes, navigation par lien. */
export function PeriodeFiltre({ actif }: { actif: Periode }) {
  return (
    <nav aria-label="Période des métriques" className="flex flex-wrap gap-2">
      {PERIODES.map((periode) => (
        <Link
          key={periode}
          href={periode === "total" ? "/admin" : `/admin?periode=${periode}`}
          aria-current={periode === actif ? "true" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            periode === actif
              ? "border-primary/50 bg-primary-soft text-primary-hover"
              : "border-border bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {PERIODE_LABELS[periode]}
        </Link>
      ))}
    </nav>
  );
}
