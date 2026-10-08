import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { rowSchema } from "@/features/database/data/database-model";
import {
  findReferences,
  type ReferenceOption as Option,
  type ReferenceTable,
} from "@/features/editor/references/reference.functions";
export { findReferences } from "@/features/editor/references/reference.functions";
const emptyFilters = {};

export function ReferenceField({
  label,
  table,
  value,
  onChange,
  filters = emptyFilters,
  disabled = false,
  useIdValue = false,
  onPick,
}: {
  label: string;
  table: ReferenceTable;
  value?: string | null;
  onChange: (value: string) => void;
  filters?: z.infer<typeof rowSchema>;
  disabled?: boolean;
  useIdValue?: boolean;
  onPick?: (option: Option) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [settled, setSettled] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Option | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(search), 150);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["database", "reference-options", table, settled, filters],
    queryFn: ({ signal }) => findReferences({ data: { table, search: settled, filters }, signal }),
    enabled: open && !disabled,
    staleTime: 30000,
  });
  const resolved = useQuery({
    queryKey: ["database", "reference-value", table, value],
    queryFn: ({ signal }) =>
      findReferences({ data: { table, search: "", filters: { id: value ?? "" } }, signal }),
    enabled: !!value && z.string().uuid().safeParse(value).success,
    staleTime: 60000,
  });
  const chosen =
    (picked && (useIdValue ? picked.id : picked.value) === value ? picked : null) ??
    resolved.data?.find((item) => item.id === value) ??
    null;
  const selected =
    chosen ??
    (value
      ? {
          id: value,
          value,
          label: value,
          organizationId: null,
          year: null,
          entityKind: null,
          image: null,
        }
      : null);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox<Option>
        items={search === settled ? (query.data ?? []) : []}
        value={selected}
        filter={null}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        inputValue={search}
        onInputValueChange={(text, details) => {
          if (details.reason === "input-change") setSearch(text);
        }}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        isItemEqualToValue={(a, b) => a.value === b.value}
        onValueChange={(item) => {
          if (!item) return;
          setPicked(item);
          onChange(useIdValue ? item.id : item.value);
          onPick?.(item);
          setSearch("");
          setOpen(false);
        }}
      >
        <ComboboxInput
          id={id}
          placeholder={chosen?.label || value || "اكتب للبحث واختر من النتائج…"}
          aria-label={label}
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {query.isFetching || search !== settled
              ? "جارٍ البحث…"
              : query.isError
                ? "تعذّر البحث، أعد فتح القائمة للمحاولة"
                : "لا توجد نتائج"}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => (
              <ComboboxItem key={item.id} value={item}>
                <span dir="auto">{item.label}</span>
                {item.label !== item.value && (
                  <span dir="auto" className="text-xs text-muted-foreground">
                    {item.value}
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {query.isError && <FieldDescription>{query.error.message}</FieldDescription>}
    </Field>
  );
}
export function ReferenceListField({
  label,
  table,
  values,
  onChange,
}: {
  label: string;
  table: ReferenceTable;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <Field>
      <ReferenceField
        label={label}
        table={table}
        onChange={(value) => {
          if (!values.includes(value)) onChange([...values, value]);
        }}
      />
      {!!values.length && (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`إزالة ${value}`}
            >
              <span dir="auto">{value}</span>
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
        </div>
      )}
    </Field>
  );
}
