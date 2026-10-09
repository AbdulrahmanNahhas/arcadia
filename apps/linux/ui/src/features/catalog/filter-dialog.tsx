import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

import { Failure } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import {
  refinementCount,
  refinementQuery,
  resetRefinements,
  yearError,
} from "./browse-refinements";
import type { BrowseRefinements, LockedFacet } from "./browse-refinements";
import { FilterFacets } from "./filter-facets";
import { criteria } from "./filter-model";
import { OrganizationFields } from "./organization-controls";

const categories = [
  {
    key: "basics",
    label: "الإصدار والنطاق",
    description: "نوع العمل، حالته وسنوات إصداره",
    facets: ["kinds", "releaseStatuses", "structureStates"],
  },
  {
    key: "story",
    label: "الحكاية والعالم",
    description: "الكواكب والأنواع والبلدان",
    facets: ["planets", "genres", "tones", "tags", "countries", "formats"],
  },
  {
    key: "family",
    label: "العائلة والمحتوى",
    description: "الجمهور والعمر والتنبيهات",
    facets: [
      "audiences",
      "ages",
      "sexualityRisks",
      "behavioralRisks",
      "theologyRisks",
      "warningStates",
    ],
  },
  {
    key: "scores",
    label: "التقييم",
    description: "التقييم العام والمعايير الستة",
    facets: ["ratingStates"],
  },
  {
    key: "people",
    label: "الصنّاع والجوائز",
    description: "الأشخاص والاستوديوهات والتكريمات",
    facets: ["studios", "contributors", "awardPrograms", "awardCategories", "awardResults"],
  },
  {
    key: "library",
    label: "مكتبتي",
    description: "المشاهدة والمفضلة والفيديو المسجّل",
    facets: ["watchStates", "favoriteStates", "playableStates"],
  },
  {
    key: "organization",
    label: "الترتيب والتجميع",
    description: "تنظيم النتائج وطريقة قراءتها",
    facets: [],
  },
];
const knownFacets = new Set(categories.flatMap((category) => category.facets));
const wideScreen = () => window.matchMedia("(min-width: 768px)").matches;
function subscribeWidth(notify: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

// Mounted on open: the draft has one owner and is discarded on every close.
export function FilterDialog({
  value,
  view,
  q,
  locked,
  onApply,
  onClose,
  returnFocus,
}: {
  value: BrowseRefinements;
  view: "works" | "installments";
  q: string;
  locked?: LockedFacet;
  onApply: (value: BrowseRefinements) => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("basics");
  const wide = useSyncExternalStore(subscribeWidth, wideScreen, () => true);
  const [previewDraft, setPreviewDraft] = useState(draft);
  useEffect(() => {
    const timer = setTimeout(() => setPreviewDraft(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);
  const previewQuery = refinementQuery(previewDraft, view, q);
  const invalid = yearError(draft.from, draft.to);
  const options = useQuery({
    queryKey: ["catalog", "facets", view, draft.privacy],
    queryFn: ({ signal }) => gateway.facets({ view, privacy: draft.privacy }, signal),
  });
  const preview = useQuery({
    queryKey: ["catalog", "preview", previewQuery],
    queryFn: ({ signal }) => gateway.browse({ ...previewQuery, page: 1, pageSize: 1 }, signal),
    enabled: !invalid && previewDraft === draft,
  });
  const pending = previewDraft !== draft || preview.isFetching;
  const activeTab = search.trim() ? "search" : category;
  const changeFilters = (filters: BrowseRefinements["filters"]) =>
    setDraft((previous) => ({ ...previous, filters }));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex h-5/6 max-h-dvh flex-col gap-5 overflow-hidden sm:max-w-6xl"
        showCloseButton={false}
        finalFocus={returnFocus}
      >
        <DialogHeader className="shrink-0 px-2 pt-2">
          <DialogTitle>مرشحات المكتبة</DialogTitle>
          <DialogDescription>
            حدّد ما تريد مشاهدته. لن تتغيّر المكتبة حتى تضغط «تطبيق المرشحات».
          </DialogDescription>
        </DialogHeader>
        <Field className="shrink-0 px-2">
          <FieldLabel htmlFor="facet-search">ابحث في المرشحات</FieldLabel>
          <Input
            id="facet-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="كوكب، نوع، بلد، صانع…"
          />
        </Field>
        <TabsPrimitive.Root
          orientation={wide ? "vertical" : "horizontal"}
          data-horizontal={wide ? undefined : ""}
          data-vertical={wide ? "" : undefined}
          value={activeTab}
          onValueChange={(next) => {
            const selected = categories.find((item) => item.key === next);
            if (selected) {
              setCategory(selected.key);
              setSearch("");
            }
          }}
          className="group/tabs flex min-h-0 flex-1 gap-6 data-horizontal:flex-col"
        >
          <TabsList
            aria-label="أقسام المرشحات"
            aria-orientation={wide ? "vertical" : "horizontal"}
            variant="line"
            className="max-w-full shrink-0 justify-start overflow-auto group-data-horizontal/tabs:h-auto md:w-56"
          >
            {categories.map((item) => (
              <TabsTrigger key={item.key} value={item.key} className="h-auto shrink-0 px-3 py-3">
                <span className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    {item.label}
                    {categoryCount(item.key, item.facets, draft, locked) > 0 && (
                      <Badge variant="secondary">
                        {categoryCount(item.key, item.facets, draft, locked)}
                      </Badge>
                    )}
                  </span>
                  {wide && (
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  )}
                </span>
              </TabsTrigger>
            ))}
            {search.trim() && <TabsTrigger value="search">نتائج البحث</TabsTrigger>}
          </TabsList>
          {[
            ...categories,
            { key: "search", label: "نتائج البحث", description: "", facets: [] },
          ].map((item) => (
            <TabsContent
              key={item.key}
              value={item.key}
              className="min-h-0 min-w-0 overflow-y-auto px-2 pb-6"
            >
              <FieldGroup>
                {item.key === "basics" && (
                  <>
                    <FieldSet>
                      <FieldLegend>الخصوصية</FieldLegend>
                      <ToggleGroup
                        variant="outline"
                        spacing={2}
                        value={[draft.privacy]}
                        aria-label="الخصوصية"
                        className="flex-wrap"
                        onValueChange={(values) => {
                          const privacy = values[0];
                          if (privacy === "public" || privacy === "private" || privacy === "all")
                            setDraft({ ...draft, privacy });
                        }}
                      >
                        <ToggleGroupItem value="public">العامة فقط</ToggleGroupItem>
                        <ToggleGroupItem value="all">العامة والخاصة</ToggleGroupItem>
                        <ToggleGroupItem value="private">الخاصة فقط</ToggleGroupItem>
                      </ToggleGroup>
                      <FieldDescription>الأعمال الخاصة مخفية افتراضيًا.</FieldDescription>
                    </FieldSet>
                    <FieldSet>
                      <FieldLegend>سنوات الإصدار</FieldLegend>
                      <FieldGroup className="grid grid-cols-2 gap-4">
                        <Field data-invalid={Boolean(invalid)}>
                          <FieldLabel htmlFor="from-year">من سنة</FieldLabel>
                          <Input
                            id="from-year"
                            type="number"
                            min={1}
                            max={9999}
                            value={draft.from}
                            aria-invalid={Boolean(invalid)}
                            aria-describedby={invalid ? "year-error" : undefined}
                            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                            placeholder={String(options.data?.yearMin ?? "")}
                          />
                        </Field>
                        <Field data-invalid={Boolean(invalid)}>
                          <FieldLabel htmlFor="to-year">إلى سنة</FieldLabel>
                          <Input
                            id="to-year"
                            type="number"
                            min={1}
                            max={9999}
                            value={draft.to}
                            aria-invalid={Boolean(invalid)}
                            aria-describedby={invalid ? "year-error" : undefined}
                            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                            placeholder={String(options.data?.yearMax ?? "")}
                          />
                        </Field>
                      </FieldGroup>
                      <FieldDescription>اترك الحقل فارغًا لعدم تقييد السنة.</FieldDescription>
                    </FieldSet>
                  </>
                )}
                {item.key === "scores" && (
                  <>
                    <ScoreInput
                      id="minimum-rating"
                      label="الحد الأدنى للتقييم العام"
                      value={draft.filters.minimumRating}
                      onChange={(minimumRating) =>
                        changeFilters({ ...draft.filters, minimumRating })
                      }
                    />
                    <FieldSet>
                      <FieldLegend>المعايير التفصيلية</FieldLegend>
                      <FieldDescription>
                        كل حد تختاره يجب أن يتحقق. صفر يعني بلا حد أدنى.
                      </FieldDescription>
                      <FieldGroup className="grid gap-5 sm:grid-cols-2">
                        {criteria.map((criterion) => (
                          <ScoreInput
                            key={criterion.key}
                            id={`score-${criterion.key}`}
                            label={criterion.label}
                            value={draft.filters.minimumScores[criterion.key]}
                            onChange={(score) =>
                              changeFilters({
                                ...draft.filters,
                                minimumScores: {
                                  ...draft.filters.minimumScores,
                                  [criterion.key]: score,
                                },
                              })
                            }
                          />
                        ))}
                      </FieldGroup>
                    </FieldSet>
                  </>
                )}
                {item.key === "organization" ? (
                  <OrganizationFields
                    sort={draft.sort}
                    group={draft.group}
                    onSort={(sort) => setDraft({ ...draft, sort })}
                    onGroup={(group) => setDraft({ ...draft, group })}
                  />
                ) : (
                  <>
                    {options.isLoading && <p role="status">جارٍ تحميل الخيارات…</p>}
                    {options.error && (
                      <Failure error={options.error} retry={() => void options.refetch()} />
                    )}
                    {options.data && (
                      <FilterFacets
                        groups={options.data.groups.filter(
                          (facet) =>
                            item.key === "search" ||
                            item.facets.includes(facet.key) ||
                            (item.key === "basics" && !knownFacets.has(facet.key)),
                        )}
                        filters={draft.filters}
                        onChange={changeFilters}
                        search={search}
                        locked={locked}
                      />
                    )}
                  </>
                )}
              </FieldGroup>
            </TabsContent>
          ))}
        </TabsPrimitive.Root>
        <DialogFooter className="shrink-0 sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1" role="status" aria-live="polite">
            {invalid ? (
              <p id="year-error">{invalid}</p>
            ) : (
              <p>
                {pending || preview.isPending
                  ? "جارٍ حساب النتائج…"
                  : preview.error
                    ? "تعذّرت معاينة العدد؛ يمكنك تطبيق المرشحات."
                    : `${preview.data?.total ?? "…"} نتيجة مطابقة`}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {refinementCount(draft, locked)} مرشح · الاختيارات في القسم الواحد بدائل، والأقسام تُطبّق
              معًا.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                setDraft({ ...resetRefinements(locked), sort: draft.sort, group: draft.group })
              }
            >
              مسح كل المرشحات
            </Button>
            <DialogClose render={<Button variant="outline" />}>إلغاء</DialogClose>
            <Button disabled={Boolean(invalid)} onClick={() => onApply(draft)}>
              تطبيق المرشحات
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function categoryCount(
  key: string,
  facets: string[],
  value: BrowseRefinements,
  locked?: LockedFacet,
) {
  const selected = value.filters.facets.filter(
    (facet) => facets.includes(facet.key) || (key === "basics" && !knownFacets.has(facet.key)),
  );
  const count =
    selected.reduce((total, facet) => total + facet.include.length + facet.exclude.length, 0) -
    Number(
      Boolean(
        locked &&
        selected.some((facet) => facet.key === locked.key && facet.include.includes(locked.value)),
      ),
    );
  if (key === "basics")
    return (
      count +
      Number(value.privacy !== "public") +
      Number(Boolean(value.from)) +
      Number(Boolean(value.to))
    );
  if (key === "scores")
    return (
      count +
      Number(value.filters.minimumRating > 0) +
      Object.values(value.filters.minimumScores).filter((score) => score > 0).length
    );
  return count;
}

function ScoreInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        min={0}
        max={10}
        step={0.1}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next >= 0 && next <= 10) onChange(next);
        }}
      />
      <FieldDescription>من 0 إلى 10 · صفر يعرض الكل</FieldDescription>
    </Field>
  );
}
