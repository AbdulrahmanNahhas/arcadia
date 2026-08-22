import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Entity, WorkContribution } from "@/features/library/model";
import { contributorRoleEntityType, contributorRolesByEntityType } from "@/features/library/model";
import { useArabicTranslations } from "@/features/library/translations";
import { Field } from "./field";

export function ContributionField({
  value = [],
  entities,
  onChange,
}: {
  value: WorkContribution[];
  entities: Pick<Entity, "id" | "name" | "entityType">[];
  onChange: (value: WorkContribution[]) => void;
}) {
  const { facetValueLabel } = useArabicTranslations();
  const update = (index: number, patch: Partial<WorkContribution>) => {
    onChange(
      value.map((contributor, current) => {
        if (current !== index) return contributor;
        const next = { ...contributor, ...patch };
        if (patch.name !== undefined && !patch.entityId) {
          next.entityId = `new:${next.entityType}:${patch.name.trim().toLocaleLowerCase()}`;
        }
        if (patch.role) next.entityType = contributorRoleEntityType(patch.role);
        if (patch.entityType && patch.entityType !== contributor.entityType) {
          next.entityId = `new:${patch.entityType}:${next.name.trim().toLocaleLowerCase()}`;
          next.role = contributorRolesByEntityType[patch.entityType][0];
        }
        return next;
      }),
    );
  };

  return (
    <Field label="صنّاع العمل والمساهمون الرئيسيون" wide>
      <div className="flex flex-col gap-2">
        {value.map((contributor, index) => (
          <div
            key={`${contributor.entityId}:${contributor.role}`}
            className="grid gap-2 rounded-md border border-border/50 bg-muted/30 p-2 sm:grid-cols-[minmax(12rem,2fr)_minmax(9rem,1fr)_7rem_auto_auto] sm:items-center"
          >
            <div className="flex min-w-0 gap-1">
              <Input
                placeholder="ابحث أو اكتب اسمًا جديدًا"
                value={contributor.name}
                onChange={(event) => update(index, { name: event.target.value })}
                className="h-8 min-w-0 bg-background text-xs"
              />
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="بحث في الجهات الموجودة"
                    >
                      <MagnifyingGlassIcon data-icon="inline-start" />
                    </Button>
                  }
                />
                <PopoverContent className="w-80 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="ابحث عن شخص أو منظمة…" />
                    <CommandList>
                      <CommandEmpty>لا توجد نتيجة. اكتب الاسم لإنشاء سجل جديد.</CommandEmpty>
                      <CommandGroup heading="السجلات الموجودة">
                        {entities
                          .filter((entity) => entity.entityType === contributor.entityType)
                          .map((entity) => (
                            <CommandItem
                              key={entity.id}
                              value={`${entity.name} ${entity.entityType}`}
                              data-checked={entity.id === contributor.entityId}
                              onSelect={() =>
                                update(index, {
                                  entityId: entity.id,
                                  name: entity.name,
                                  entityType: entity.entityType,
                                })
                              }
                            >
                              <span className="truncate">{entity.name}</span>
                              <Badge variant="outline">
                                {entity.entityType === "person" ? "شخص" : "منظمة"}
                              </Badge>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Select
              items={contributorRolesByEntityType[contributor.entityType].map((role) => ({
                value: role,
                label: facetValueLabel("creatorRoles", role),
              }))}
              value={contributor.role}
              onValueChange={(role) => {
                // SAFETY: `items` above is built from `contributorRolesByEntityType`, which only
                // contains real `WorkContribution["role"]` values.
                update(index, { role: (role ?? "creator") as WorkContribution["role"] });
              }}
            >
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue placeholder="الدور" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {contributorRolesByEntityType[contributor.entityType].map((role) => (
                    <SelectItem key={role} value={role}>
                      {facetValueLabel("creatorRoles", role)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              items={[
                { value: "person", label: "شخص" },
                { value: "organization", label: "منظمة" },
              ]}
              value={contributor.entityType}
              onValueChange={(entityType) => {
                // SAFETY: `items` above only offers "person"/"organization" — the same union as
                // `WorkContribution["entityType"]`.
                update(index, {
                  entityType: (entityType ?? "person") as WorkContribution["entityType"],
                });
              }}
            >
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="person">شخص</SelectItem>
                  <SelectItem value="organization">منظمة</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <label
              htmlFor={`contribution-primary-${contributor.entityId}-${contributor.role}`}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Switch
                id={`contribution-primary-${contributor.entityId}-${contributor.role}`}
                aria-label={`مساهمة رئيسية: ${contributor.name}`}
                checked={contributor.isPrimary}
                onCheckedChange={(isPrimary) => update(index, { isPrimary })}
              />
              رئيسي
            </label>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(value.filter((_, current) => current !== index))}
              aria-label="حذف المساهمة"
            >
              <TrashIcon data-icon="inline-start" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...value,
              {
                entityId: `new:person:${crypto.randomUUID()}`,
                name: "",
                entityType: "person",
                role: "creator",
                isPrimary: false,
              },
            ])
          }
          className="w-full border-dashed"
        >
          <PlusIcon data-icon="inline-start" />
          إضافة مساهم
        </Button>
      </div>
    </Field>
  );
}
