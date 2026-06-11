import { CheckCircle2, Clock, PencilLine, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { STATUT_BADGE_VARIANTS, STATUT_LABELS, type StatutSeance } from "../statuts";

/** Icône par statut — B4 : un statut n'est jamais distingué par la seule couleur. */
const STATUT_ICONS: Record<StatutSeance, typeof Clock> = {
  en_attente: Clock,
  validee: CheckCircle2,
  modifiee: PencilLine,
  refusee: XCircle,
};

/** Badge de statut de séance (B4) : couleur sémantique + icône + libellé. */
export function StatutBadge({ statut }: { statut: StatutSeance }) {
  const Icon = STATUT_ICONS[statut];
  return (
    <Badge variant={STATUT_BADGE_VARIANTS[statut]}>
      <Icon aria-hidden />
      {STATUT_LABELS[statut]}
    </Badge>
  );
}
