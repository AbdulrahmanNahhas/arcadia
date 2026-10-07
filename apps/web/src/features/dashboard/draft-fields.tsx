import { useId } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface DraftFieldProps {
  label: string;
  placeholder?: string;
  description?: string;
  multiline?: boolean;
  type?: "text" | "number" | "url" | "password";
  step?: string;
  min?: number;
  max?: number;
}
export function DraftField({
  label,
  placeholder,
  description,
  multiline = false,
  type = "text",
  step,
  min,
  max,
}: DraftFieldProps) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea id={id} placeholder={placeholder} rows={4} />
      ) : (
        <Input id={id} type={type} step={step} min={min} max={max} placeholder={placeholder} />
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
interface ChoiceFieldProps {
  label: string;
  options: readonly { value: string; label: string }[];
}
export function ChoiceField({ label, options }: ChoiceFieldProps) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={options} defaultValue={options[0]?.value ?? null}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
