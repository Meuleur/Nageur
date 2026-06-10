import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Message d'erreur sous le champ concerné (B2, accessibilité B4). */
export function FieldErrors({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }
  return (
    <p id={id} className="text-caption text-status-refused-text">
      {errors.join(" ")}
    </p>
  );
}

type FormFieldProps = React.ComponentProps<"input"> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

/** Champ standard B4 : label au-dessus, aide/erreur sous le champ. */
export function FormField({ label, name, errors, hint, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-erreur`;
  const hintId = `${name}-aide`;
  const hasError = Boolean(errors?.length);
  const describedBy =
    [hasError ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldErrors id={errorId} errors={errors} />
    </div>
  );
}
