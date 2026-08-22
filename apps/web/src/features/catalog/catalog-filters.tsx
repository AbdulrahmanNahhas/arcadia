import {
  CaretDownIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { scoreCriteria, scoreCriterionLabels } from "@/features/library/scoring";
import { kindLabelsAr, useArabicTranslations } from "@/features/library/translations";
import { cn } from "@/lib/utils";
import {
  type CatalogFacetKey,
  type CatalogFacetOption,
  type CatalogFacetOptions,
  type CatalogFilterState,
  countCatalogFilters,
  cycleCatalogSelection,
  setMinimumScore,
} from "./catalog-filtering";

type CatalogFiltersProps = {
  filters: CatalogFilterState;
  onChange: Dispatch<SetStateAction<CatalogFilterState>>;
  options: CatalogFacetOptions;
  matchingCount: number;
  onClear: () => void;
  allowPrivacy?: boolean;
  disabled?: boolean;
};

const fixedLabels: Record<string, string> = {
  upcoming: "قادم",
  airing: "يعرض الآن",
  returning: "مستمر",
  completed: "مكتمل",
  unknown: "غير معروف",
  rated: "مقيّم",
  unrated: "غير مقيّم",
  warnings: "به تحذيرات",
  none: "لا يوجد",
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  title: "عنوان كامل",
  season: "موسم",
  standalone: "فيلم أو إصدار مستقل",
  winner: "فائز",
  nominee: "مرشّح",
  General: "عام",
  Teen: "مراهقون",
  "Young Adult": "شباب",
  Adult: "بالغون",
};

const facetVocabulary: Partial<Record<CatalogFacetKey, string>> = {
  genres: "genre",
  tones: "tone",
  tags: "tag",
  countries: "country",
  audiences: "audience",
};

export function CatalogFilterSidebar(props: CatalogFiltersProps) {
  return (
    <aside className="hidden min-w-0 lg:block sticky! top-20" aria-label="مرشحات الكتالوج">
      <div className="max-h-[calc(100svh-6rem)] overflow-y-auto rounded-3xl border bg-card/45 shadow-sm backdrop-blur-xl">
        <FilterHeader {...props} />
        <CatalogFilterContent {...props} />
      </div>
    </aside>
  );
}

export function CatalogFilterSheet(props: CatalogFiltersProps & { className?: string }) {
  const activeCount = countCatalogFilters(props.filters);
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant={activeCount ? "secondary" : "outline"}
        size="sm"
        className={cn("lg:hidden", props.className)}
        disabled={props.disabled}
        onClick={() => setOpen(true)}
      >
        <FunnelSimpleIcon data-icon="inline-start" />
        المرشحات
        {activeCount ? <Badge variant="secondary">{activeCount}</Badge> : null}
      </Button>
      <SheetContent side="right" className="w-full p-0 sm:max-w-md" dir="rtl">
        <SheetHeader className="border-b pe-14 text-start">
          <SheetTitle>مرشحات قاعدة البيانات</SheetTitle>
          <SheetDescription>ضمّن أو استبعد أي قيمة، وشاهد النتائج تتحدّث فوراً.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CatalogFilterContent {...props} />
        </div>
        <SheetFooter className="border-t bg-background/95">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={props.onClear} disabled={!activeCount}>
              <XIcon data-icon="inline-start" />
              مسح الكل
            </Button>
            <SheetClose render={<Button />}>عرض {props.matchingCount} نتيجة</SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FilterHeader(props: CatalogFiltersProps) {
  const activeCount = countCatalogFilters(props.filters);
  return (
    <div className="sticky top-0 border-b bg-card px-5 py-4 backdrop-blur-xl z-20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FunnelSimpleIcon className="text-primary" />
            <h2 className="font-heading font-semibold">ضيّق الاختيار</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{props.matchingCount} نتيجة مطابقة</p>
        </div>
        {activeCount ? (
          <Button variant="ghost" size="xs" onClick={props.onClear}>
            مسح {activeCount}
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <PlusIcon className="text-primary" /> تضمين
        </span>
        <span className="flex items-center gap-1">
          <MinusIcon className="text-destructive" /> استبعاد
        </span>
      </div>
    </div>
  );
}

function CatalogFilterContent(props: CatalogFiltersProps) {
  const updateFacet = (key: CatalogFacetKey, value: string) =>
    props.onChange((current) => ({
      ...current,
      facets: {
        ...current.facets,
        [key]: cycleCatalogSelection(current.facets[key], value),
      },
    }));

  return (
    <div className="flex flex-col px-5 pb-6">
      <FilterSection
        title="العمل والإصدار"
        description="النوع وحالة العمل المحسوبة من أجزائه ومستوى العرض"
        open
      >
        <FacetList
          facet="kinds"
          options={props.options.kinds}
          filters={props.filters}
          onCycle={updateFacet}
        />
        <FacetLabel>حالة العمل</FacetLabel>
        <FacetList
          facet="releaseStatuses"
          options={props.options.releaseStatuses}
          filters={props.filters}
          onCycle={updateFacet}
        />
        {props.options.structureStates.length > 1 ? (
          <>
            <FacetLabel>البنية</FacetLabel>
            <FacetList
              facet="structureStates"
              options={props.options.structureStates}
              filters={props.filters}
              onCycle={updateFacet}
            />
          </>
        ) : null}
      </FilterSection>

      <FilterSection title="التقييم" description="التقييم العام أو معيار بعينه">
        <FacetList
          facet="ratingStates"
          options={props.options.ratingStates}
          filters={props.filters}
          onCycle={updateFacet}
        />
        <ScoreSlider
          label="التقييم العام"
          value={props.filters.minimumRating}
          onChange={(minimumRating) => props.onChange((current) => ({ ...current, minimumRating }))}
        />
        {scoreCriteria.map((criterion) => (
          <ScoreSlider
            key={criterion}
            label={scoreCriterionLabels[criterion].ar}
            value={props.filters.minimumScores[criterion] ?? 0}
            onChange={(value) =>
              props.onChange((current) => ({
                ...current,
                minimumScores: setMinimumScore(current.minimumScores, criterion, value),
              }))
            }
          />
        ))}
        <p className="text-[11px] leading-5 text-muted-foreground">
          في العناوين المتعددة، كل معيار هو متوسط درجات المواسم أو الإصدارات المسجّلة.
        </p>
      </FilterSection>

      {props.options.awardPrograms.length > 0 ? (
        <FilterSection title="الجوائز" description="الجهة المانحة والنتيجة المسجّلة" open>
          <FacetList
            facet="awardPrograms"
            options={props.options.awardPrograms}
            filters={props.filters}
            onCycle={updateFacet}
            searchable
          />
          <FacetLabel>النتيجة</FacetLabel>
          <FacetList
            facet="awardResults"
            options={props.options.awardResults}
            filters={props.filters}
            onCycle={updateFacet}
          />
          <FacetLabel>الفئة</FacetLabel>
          <FacetList
            facet="awardCategories"
            options={props.options.awardCategories}
            filters={props.filters}
            onCycle={updateFacet}
            searchable
          />
        </FilterSection>
      ) : null}

      <FilterSection title="التصنيفات" description="النوع الفني، الجو، والموضوعات">
        <FacetList
          facet="genres"
          options={props.options.genres}
          filters={props.filters}
          onCycle={updateFacet}
          searchable
        />
        <FacetLabel>الطابع</FacetLabel>
        <FacetList
          facet="tones"
          options={props.options.tones}
          filters={props.filters}
          onCycle={updateFacet}
          searchable
        />
        <FacetLabel>الوسوم</FacetLabel>
        <FacetList
          facet="tags"
          options={props.options.tags}
          filters={props.filters}
          onCycle={updateFacet}
          searchable
        />
      </FilterSection>

      <FilterSection title="إرشادات المحتوى" description="الجمهور والمخاطر المسجّلة">
        <FacetList
          facet="audiences"
          options={props.options.audiences}
          filters={props.filters}
          onCycle={updateFacet}
        />
        <FacetLabel>التحذيرات</FacetLabel>
        <FacetList
          facet="warningStates"
          options={props.options.warningStates}
          filters={props.filters}
          onCycle={updateFacet}
        />
        <FacetLabel>المحتوى الجنسي</FacetLabel>
        <FacetList
          facet="sexualityRisks"
          options={props.options.sexualityRisks}
          filters={props.filters}
          onCycle={updateFacet}
        />
        <FacetLabel>العنف والسلوك</FacetLabel>
        <FacetList
          facet="behavioralRisks"
          options={props.options.behavioralRisks}
          filters={props.filters}
          onCycle={updateFacet}
        />
        <FacetLabel>الموضوعات الدينية</FacetLabel>
        <FacetList
          facet="theologyRisks"
          options={props.options.theologyRisks}
          filters={props.filters}
          onCycle={updateFacet}
        />
      </FilterSection>

      <FilterSection title="الزمن والمنشأ" description="سنة الإصدار والدولة">
        <FieldGroup className="gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="catalog-year-from">من سنة</FieldLabel>
              <Input
                id="catalog-year-from"
                type="number"
                inputMode="numeric"
                value={props.filters.yearFrom ?? ""}
                placeholder="1900"
                onChange={(event) =>
                  props.onChange((current) => ({
                    ...current,
                    yearFrom: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="catalog-year-to">إلى سنة</FieldLabel>
              <Input
                id="catalog-year-to"
                type="number"
                inputMode="numeric"
                value={props.filters.yearTo ?? ""}
                placeholder="2026"
                onChange={(event) =>
                  props.onChange((current) => ({
                    ...current,
                    yearTo: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </Field>
          </div>
        </FieldGroup>
        <FacetLabel>الدولة</FacetLabel>
        <FacetList
          facet="countries"
          options={props.options.countries}
          filters={props.filters}
          onCycle={updateFacet}
          searchable
        />
      </FilterSection>

      {(props.options.studios.length > 0 || props.options.contributors.length > 0) && (
        <FilterSection title="صنّاع العمل" description="الاستوديوهات والأسماء المشاركة">
          <FacetList
            facet="studios"
            options={props.options.studios}
            filters={props.filters}
            onCycle={updateFacet}
            searchable
          />
          {props.options.contributors.length > 0 ? (
            <>
              <FacetLabel>المساهمون</FacetLabel>
              <FacetList
                facet="contributors"
                options={props.options.contributors}
                filters={props.filters}
                onCycle={updateFacet}
                searchable
              />
            </>
          ) : null}
        </FilterSection>
      )}

      {props.allowPrivacy ? (
        <FilterSection title="الخصوصية" description="متاح لحساب المدير فقط" open>
          <ToggleGroup
            value={[props.filters.privacy]}
            multiple={false}
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
            aria-label="عرض الأعمال الخاصة"
            onValueChange={(values) => {
              const privacy = values[0] as CatalogFilterState["privacy"] | undefined;
              if (privacy) props.onChange((current) => ({ ...current, privacy }));
            }}
          >
            <ToggleGroupItem value="public" className="flex-1">
              العامة
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="flex-1">
              الكل
            </ToggleGroupItem>
            <ToggleGroupItem value="private" className="flex-1">
              الخاصة
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-[11px] leading-5 text-muted-foreground">
            الافتراضي يستبعد الأعمال الخاصة. اختر «الكل» لتضمينها أو «الخاصة» لحصر النتائج فيها.
          </p>
        </FilterSection>
      ) : null}
    </div>
  );
}

function FilterSection({
  title,
  description,
  children,
  open = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="group border-b py-1 last:border-b-0" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{description}</span>
        </span>
        <CaretDownIcon className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 pb-5">{children}</div>
    </details>
  );
}

function FacetLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs font-medium text-muted-foreground">{children}</p>;
}

function FacetList({
  facet,
  options,
  filters,
  onCycle,
  searchable = false,
}: {
  facet: CatalogFacetKey;
  options: CatalogFacetOption[];
  filters: CatalogFilterState;
  onCycle: (facet: CatalogFacetKey, value: string) => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const { taxonomyLabel } = useArabicTranslations();
  const labelFor = (value: string) => {
    if (facet === "kinds") return kindLabelsAr[value as keyof typeof kindLabelsAr] ?? value;
    const vocabulary = facetVocabulary[facet];
    return fixedLabels[value] ?? (vocabulary ? taxonomyLabel(vocabulary, value) : value);
  };
  const needle = query.trim().toLocaleLowerCase();
  const visibleOptions = (
    needle
      ? options.filter((option) => labelFor(option.value).toLocaleLowerCase().includes(needle))
      : options
  ).slice(0, query ? 30 : 18);

  if (!options.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {searchable && options.length > 9 ? (
        <InputGroup>
          <InputGroupAddon>
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث داخل القائمة…"
            aria-label="البحث داخل خيارات المرشح"
          />
        </InputGroup>
      ) : null}
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pe-1">
        {visibleOptions.map((option) => {
          const selection = filters.facets[facet];
          const mode = selection.include.includes(option.value)
            ? "include"
            : selection.exclude.includes(option.value)
              ? "exclude"
              : null;
          return (
            <Button
              key={option.value}
              type="button"
              variant={
                mode === "include" ? "secondary" : mode === "exclude" ? "destructive" : "outline"
              }
              size="xs"
              aria-pressed={Boolean(mode)}
              aria-label={`${labelFor(option.value)}: ${mode === "include" ? "مضمّن" : mode === "exclude" ? "مستبعَد" : "غير محدد"}`}
              onClick={() => onCycle(facet, option.value)}
            >
              {mode === "include" ? <PlusIcon data-icon="inline-start" /> : null}
              {mode === "exclude" ? <MinusIcon data-icon="inline-start" /> : null}
              {labelFor(option.value)}
              <span className="text-[10px] opacity-60">{option.count}</span>
            </Button>
          );
        })}
      </div>
      {!visibleOptions.length ? (
        <p className="text-xs text-muted-foreground">لا توجد خيارات مطابقة.</p>
      ) : null}
    </div>
  );
}

function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field className="gap-2">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="font-mono text-xs text-muted-foreground">
          {value > 0 ? `${value}+` : "الكل"}
        </span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={10}
        step={0.5}
        aria-label={`الحد الأدنى: ${label}`}
        onValueChange={(values) => onChange(typeof values === "number" ? values : (values[0] ?? 0))}
      />
    </Field>
  );
}
