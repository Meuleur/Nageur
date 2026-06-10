import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5 rounded-md border px-4 py-3 text-sm has-[>svg]:pl-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        // Statuts B4 : la couleur n'est jamais seule (icône + texte).
        default: "border-primary/30 bg-primary-soft text-primary-hover",
        success: "border-status-valid/30 bg-status-valid-soft text-status-valid-text",
        destructive: "border-status-refused/30 bg-status-refused-soft text-status-refused-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription };
