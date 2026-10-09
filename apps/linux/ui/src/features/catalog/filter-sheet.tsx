import type { BrowseFilters, FacetCatalog } from "@nahhasio/api-contract";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Slider } from "../../components/ui/slider";
import { criteria, cycle, emptyFilters, optionLabel } from "./filter-model";
export function FilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  options,
  total,
  privacy,
  onPrivacy,
  yearFrom,
  yearTo,
  onYears,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: BrowseFilters;
  onChange: (v: BrowseFilters) => void;
  options?: FacetCatalog;
  total?: number;
  privacy: string;
  onPrivacy: (v: string) => void;
  yearFrom: string;
  yearTo: string;
  onYears: (a: string, b: string) => void;
}) {
  const [find, setFind] = useState("");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>مرشحات المكتبة</SheetTitle>
          <SheetDescription>
            {total ?? "…"} نتيجة · اضغط للاختيار، ثم للاستبعاد، ثم لإزالة الاختيار.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="facet-search">ابحث في المرشحات</FieldLabel>
              <Input
                id="facet-search"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="تصنيف، بلد، صانع، استوديو…"
              />
            </Field>
            <FieldSet>
              <FieldLegend>الخصوصية</FieldLegend>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "public", label: "العامة فقط" },
                  { value: "all", label: "العامة والخاصة" },
                  { value: "private", label: "الخاصة فقط" },
                ].map((item) => (
                  <Button
                    key={item.value}
                    variant={privacy === item.value ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={privacy === item.value}
                    onClick={() => onPrivacy(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </FieldSet>
            <FieldSet>
              <FieldLegend>سنوات الإصدار</FieldLegend>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="from-year">من سنة</FieldLabel>
                  <Input
                    id="from-year"
                    type="number"
                    min="1"
                    max="9999"
                    value={yearFrom}
                    onChange={(e) => onYears(e.target.value, yearTo)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="to-year">إلى سنة</FieldLabel>
                  <Input
                    id="to-year"
                    type="number"
                    min="1"
                    max="9999"
                    value={yearTo}
                    onChange={(e) => onYears(yearFrom, e.target.value)}
                  />
                </Field>
              </div>
            </FieldSet>
            <Field>
              <FieldLabel>الحد الأدنى للتقييم العام · {filters.minimumRating || "الكل"}</FieldLabel>
              <Slider
                aria-label="الحد الأدنى للتقييم العام"
                min={0}
                max={10}
                step={0.1}
                value={[filters.minimumRating]}
                onValueChange={(v) =>
                  onChange({ ...filters, minimumRating: Array.isArray(v) ? v[0] : v })
                }
              />
            </Field>
            <details>
              <summary className="cursor-pointer text-sm">المعايير التفصيلية</summary>
              <FieldGroup className="mt-5">
                {criteria.map((criterion) => (
                  <Field key={criterion.key}>
                    <FieldLabel>
                      {criterion.label} · {filters.minimumScores[criterion.key] || "الكل"}
                    </FieldLabel>
                    <Slider
                      aria-label={criterion.label}
                      min={0}
                      max={10}
                      step={0.5}
                      value={[filters.minimumScores[criterion.key]]}
                      onValueChange={(v) =>
                        onChange({
                          ...filters,
                          minimumScores: {
                            ...filters.minimumScores,
                            [criterion.key]: Array.isArray(v) ? v[0] : v,
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </FieldGroup>
            </details>
            {options?.groups.map((group) => {
              const selection = filters.facets.find((s) => s.key === group.key);
              const visible = group.options.filter((item) =>
                `${group.label} ${optionLabel(item.value, item.label)}`.includes(find),
              );
              if (!visible.length) return null;
              return (
                <FieldSet key={group.key}>
                  <FieldLegend>{group.label}</FieldLegend>
                  <div className="flex flex-wrap gap-2">
                    {visible.map((item) => {
                      const included = selection?.include.includes(item.value);
                      const excluded = selection?.exclude.includes(item.value);
                      const state = excluded ? "مستبعد" : included ? "محدد" : "غير محدد";
                      return (
                        <Button
                          key={item.value}
                          size="sm"
                          variant={excluded ? "destructive" : included ? "secondary" : "outline"}
                          aria-label={`${optionLabel(item.value, item.label)}: ${state}`}
                          aria-pressed={Boolean(included || excluded)}
                          onClick={() => onChange(cycle(filters, group.key, item.value))}
                          className="max-w-full"
                        >
                          <span className="truncate">
                            {excluded ? "− " : included ? "+ " : ""}
                            {optionLabel(item.value, item.label)}
                          </span>
                          <small>{item.count}</small>
                        </Button>
                      );
                    })}
                  </div>
                </FieldSet>
              );
            })}
          </FieldGroup>
        </div>
        <SheetFooter>
          <Button onClick={() => onOpenChange(false)}>عرض النتائج</Button>
          <Button
            variant="outline"
            onClick={() => {
              onChange(emptyFilters());
              onPrivacy("public");
              onYears("", "");
            }}
          >
            مسح كل المرشحات
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
