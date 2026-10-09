import type { BrowseFilters, FacetCatalog } from "@nahhasio/api-contract";
import { ChevronDownIcon, LockKeyholeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { withPreset } from "./browse-refinements";
import { optionLabel } from "./filter-model";

type FilterFacetsProps = {
  groups: FacetCatalog["groups"];
  filters: BrowseFilters;
  onChange: (filters: BrowseFilters) => void;
  search: string;
  locked?: { key: string; value: string };
};

type SelectionMode = "include" | "exclude";

export function FilterFacets({ groups, filters, onChange, search, locked }: FilterFacetsProps) {
  const [mode, setMode] = useState<SelectionMode>("include");
  const modeId = useId();
  const query = search.trim().toLocaleLowerCase();
  const matchingGroups = groups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          group.label.toLocaleLowerCase().includes(query) ||
          optionLabel(option.value, option.label).toLocaleLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.options.length > 0);

  function changeOption(key: string, value: string, checked: boolean) {
    if (locked?.key === key && locked.value === value) return;

    const previous = filters.facets.find((facet) => facet.key === key) ?? {
      key,
      include: [],
      exclude: [],
    };
    const next = {
      ...previous,
      include:
        mode === "include"
          ? checked
            ? [...previous.include.filter((item) => item !== value), value]
            : previous.include.filter((item) => item !== value)
          : checked
            ? previous.include.filter((item) => item !== value)
            : previous.include,
      exclude:
        mode === "exclude"
          ? checked
            ? [...previous.exclude.filter((item) => item !== value), value]
            : previous.exclude.filter((item) => item !== value)
          : checked
            ? previous.exclude.filter((item) => item !== value)
            : previous.exclude,
    };
    const facets = [...filters.facets.filter((facet) => facet.key !== key), next].filter(
      (facet) => facet.include.length > 0 || facet.exclude.length > 0,
    );
    onChange(withPreset({ ...filters, facets }, locked));
  }

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend id={modeId}>طريقة الاختيار</FieldLegend>
        <ToggleGroup
          aria-labelledby={modeId}
          variant="outline"
          value={[mode]}
          onValueChange={(values) => {
            const value = values[0];
            if (value === "include" || value === "exclude") setMode(value);
          }}
        >
          <ToggleGroupItem value="include">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            تضمين
          </ToggleGroupItem>
          <ToggleGroupItem value="exclude">
            <MinusIcon data-icon="inline-start" aria-hidden="true" />
            استبعاد
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>
          اختر ما تريد تضمينه أو استبعاده. الاستبعاد يخفي كل نتيجة تطابق الخيار.
        </FieldDescription>
      </FieldSet>
      {matchingGroups.length === 0 ? (
        <FieldDescription role="status">لا توجد خيارات مطابقة للبحث.</FieldDescription>
      ) : (
        matchingGroups.map((group) => (
          <FacetOptions
            key={JSON.stringify([group.key, query])}
            group={group}
            filters={filters}
            mode={mode}
            locked={locked}
            onSelect={changeOption}
          />
        ))
      )}
    </FieldGroup>
  );
}

function FacetOptions({
  group,
  filters,
  mode,
  locked,
  onSelect,
}: {
  group: FacetCatalog["groups"][number];
  filters: BrowseFilters;
  mode: SelectionMode;
  locked: FilterFacetsProps["locked"];
  onSelect: (key: string, value: string, checked: boolean) => void;
}) {
  const [limit, setLimit] = useState(30);
  const id = useId();
  const selection = filters.facets.find((facet) => facet.key === group.key);
  const visible = group.options.slice(0, limit);
  const remaining = group.options.length - visible.length;

  return (
    <FieldSet>
      <FieldLegend>{group.label}</FieldLegend>

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        {visible.map((option) => {
          const optionId = `${id}-${encodeURIComponent(option.value)}`;
          const isLocked = locked?.key === group.key && locked.value === option.value;
          const included = isLocked || Boolean(selection?.include.includes(option.value));
          const excluded = !isLocked && Boolean(selection?.exclude.includes(option.value));
          const label = optionLabel(option.value, option.label);
          const state = included ? "مضمّن" : excluded ? "مستبعد" : "غير محدد";

          return (
            <Field key={option.value} orientation="horizontal" data-disabled={isLocked}>
              <Checkbox
                id={optionId}
                disabled={isLocked}
                checked={isLocked || (mode === "include" ? included : excluded)}
                aria-describedby={`${optionId}-details`}
                onCheckedChange={(checked) => onSelect(group.key, option.value, checked)}
              />
              <FieldContent>
                <FieldLabel htmlFor={optionId}>{label}</FieldLabel>
                <FieldDescription id={`${optionId}-details`}>
                  {option.count} في المكتبة
                </FieldDescription>
              </FieldContent>
              {included || excluded ? (
                <Badge variant={excluded ? "destructive" : "secondary"}>
                  {isLocked ? (
                    <LockKeyholeIcon data-icon="inline-start" aria-hidden="true" />
                  ) : null}
                  {state}
                  {isLocked ? " · مقفل" : null}
                </Badge>
              ) : null}
            </Field>
          );
        })}
      </FieldGroup>
      {remaining > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          aria-label={`عرض المزيد من ${group.label}، ${remaining} خيارًا متبقيًا`}
          onClick={() => setLimit((current) => current + 30)}
        >
          <ChevronDownIcon data-icon="inline-start" aria-hidden="true" />
          عرض المزيد ({remaining})
        </Button>
      ) : null}
    </FieldSet>
  );
}
