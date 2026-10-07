import type { ReactNode } from "react";
import { Field as BaseField, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, wide = false, className, children }: FieldProps) {
  return (
    <BaseField
      className={cn("flex flex-col justify-start gap-1.5", wide && "sm:col-span-2", className)}
    >
      <FieldLabel className="text-xs font-medium text-muted-foreground">{label}</FieldLabel>
      {children}
    </BaseField>
  );
}
