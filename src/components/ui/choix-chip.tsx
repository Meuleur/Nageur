import { Check } from "lucide-react";

/**
 * Pastille sélectionnable (radio ou case) — état coché visible au-delà de la
 * couleur (B4). Extraite du formulaire profil (CH3) pour resservir aux
 * échelles de l'auto-évaluation (CH5).
 */
export function ChoixChip({
  type,
  name,
  value,
  label,
  ariaLabel,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  ariaLabel?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors select-none peer-checked:border-primary/50 peer-checked:bg-primary-soft peer-checked:text-primary-hover peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-muted">
        {checked ? <Check className="size-4" aria-hidden /> : null}
        {label}
      </span>
    </label>
  );
}
