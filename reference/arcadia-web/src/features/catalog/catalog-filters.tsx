import {
  CaretDownIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { type Dispatch, type SetStateAction, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { tagLabelsAr, taxonomyLabels } from "@/features/library/model";
import { scoreCriteria, scoreCriterionLabels } from "@/features/library/scoring";
import { kindLabelsAr, useArabicTranslations } from "@/features/library/translations";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  type CatalogFacetKey,
  type CatalogFacetOption,
  type CatalogFacetOptions,
  type CatalogFilterState,
  type CatalogSelection,
  type CatalogWatchState,
  countCatalogFilters,
  createCatalogFilters,
  cycleCatalogSelection,
  isDefaultPlayableSelection,
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

// Genre/tone/tag/country facet *values* come from `getCatalogFacetValues()`, which reads
// straight off `Work.genres`/`.tone`/`.tags`/`.country` — and those hold the canonical
// **English** label (see `catalogTermLabel` in `work-detail-page.tsx` for the full story), not a
// slug. `taxonomyLabel(vocabulary, value)` below is the slug-keyed DB system and silently misses
// these, falling back to the raw English text. Check the English-label-keyed maps first.
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
  playable: "قابل للتشغيل",
  "not-playable": "غير قابل للتشغيل بعد",
  watched: "تمّت مشاهدته",
  "in-progress": "قيد المشاهدة",
  unwatched: "لم يُشاهَد",
  winner: "فائز",
  nominee: "مرشّح",
  General: "عام",
  Teen: "مراهقون",
  "Young Adult": "شباب",
  Adult: "بالغون",
  ...taxonomyLabels.ages,
  ...taxonomyLabels.genres,
  ...taxonomyLabels.tones,
  ...taxonomyLabels.countries,
  ...tagLabelsAr,
};

const facetVocabulary: Partial<Record<CatalogFacetKey, string>> = {
  genres: "genre",
  tones: "tone",
  tags: "tag",
  countries: "country",
  audiences: "audience",
};

const facetLabels: Record<CatalogFacetKey, string> = {
  kinds: "النوع",
  releaseStatuses: "حالة العمل",
  audiences: "الجمهور",
  ages: "الفئة العمرية",
  genres: "النوع الفني",
  tones: "الطابع",
  tags: "الوسوم",
  countries: "الدولة",
  studios: "الاستوديو",
  contributors: "المساهمون",
  awardPrograms: "الجهة المانحة",
  awardCategories: "فئة الجائزة",
  awardResults: "نتيجة الجائزة",
  ratingStates: "حالة التقييم",
  warningStates: "التحذيرات",
  structureStates: "البنية",
  playableStates: "التشغيل",
  watchStates: "المشاهدة",
  sexualityRisks: "المحتوى الجنسي",
  behavioralRisks: "العنف والسلوك",
  theologyRisks: "الموضوعات الدينية",
};

const watchStateOrder: CatalogWatchState[] = ["unwatched", "in-progress", "watched"];

/** How many chips a long facet shows before folding the rest behind "+N". */
const FACET_PREVIEW = 12;
/** Past this many options a folded-open facet also gets its own search box. */
const FACET_SEARCH_THRESHOLD = 20;

function useFacetLabel(facet: CatalogFacetKey) {
  const { taxonomyLabel } = useArabicTranslations();
  return (value: string) => {
    if (facet === "kinds") return kindLabelsAr[value as keyof typeof kindLabelsAr] ?? value;
    const vocabulary = facetVocabulary[facet];
    return fixedLabels[value] ?? (vocabulary ? taxonomyLabel(vocabulary, value) : value);
  };
}

/**
 * The same filters as a drawer: a bottom sheet with a swipe handle on a phone, a side panel on
 * anything wider. One scrolling body, no collapsed sections and no scrollboxes inside it — every
 * choice is either visible or one "+N" tap away, and the header keeps reporting how many results
 * the current choices leave, so the drawer can stay open while narrowing down.
 */
export function CatalogFilterDrawer(props: CatalogFiltersProps & { className?: string }) {
  const activeCount = countCatalogFilters(props.filters);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      showSwipeHandle={isMobile}
      swipeDirection={isMobile ? "down" : "right"}
    >
      <Button
        variant={activeCount ? "secondary" : "outline"}
        size="sm"
        className={cn("h-10 gap-2 rounded-xl px-4 text-xs font-medium", props.className)}
        disabled={props.disabled}
        onClick={() => setOpen(true)}
      >
        <FunnelSimpleIcon className="size-4 text-muted-foreground" />
        المرشحات
        {activeCount ? (
          <Badge className="ms-0.5 size-5 justify-center rounded-full p-0 text-[10px] font-bold">
            {activeCount}
          </Badge>
        ) : null}
      </Button>
      <DrawerContent
        className="sm:[--drawer-content-width:30rem]! sm:max-w-none! bg-card/90 backdrop-blur-2xl"
        dir="rtl"
      >
        <DrawerHeader className="gap-1 border-b border-border/50 pb-4 text-start! md:text-start">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
                <FunnelSimpleIcon className="size-5 text-primary" />
                المرشحات
              </DrawerTitle>
              <DrawerDescription className="mt-1 text-start">
                <ResultCount count={props.matchingCount} />
              </DrawerDescription>
            </div>
            {activeCount ? (
              <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={props.onClear}>
                <XIcon data-icon="inline-start" />
                مسح الكل
              </Button>
            ) : null}
          </div>
          <ActiveFilterStrip {...props} />
        </DrawerHeader>
        <div className="scroll-fade-y min-h-0 flex-1 overflow-y-auto">
          <CatalogFilterContent {...props} />
        </div>
        <DrawerFooter className="border-t border-border/50 pt-4 sm:flex-row-reverse">
          <DrawerClose render={<Button className="h-10 flex-1 font-semibold" />}>
            عرض {props.matchingCount} نتيجة
          </DrawerClose>
          <DrawerClose render={<Button variant="outline" className="h-10" />}>إغلاق</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function ResultCount({ count }: { count: number }) {
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-foreground">{count}</span> نتيجة مطابقة
    </span>
  );
}

/* ----------------------------------------------------------------------- */
/* Active filters                                                            */
/* ----------------------------------------------------------------------- */

/**
 * Everything currently narrowing the list, as one row of removable chips under the header. In a
 * long filter list the choices that matter are scattered across sections; this is the one place
 * to see them together and undo any of them without scrolling to find where it lives.
 */
function ActiveFilterStrip({ filters, onChange, options }: CatalogFiltersProps) {
  const chips: {
    key: string;
    label: string;
    tone: "include" | "exclude" | "range";
    clear: () => void;
  }[] = [];
  const setFacet = (facet: CatalogFacetKey, next: CatalogSelection) =>
    onChange((current) => ({ ...current, facets: { ...current.facets, [facet]: next } }));

  for (const facet of Object.keys(filters.facets) as CatalogFacetKey[]) {
    const selection = filters.facets[facet];
    if (facet === "playableStates" && isDefaultPlayableSelection(selection)) continue;
    // The section itself may be hidden (no options) — a chip for it would be un-undoable there.
    if (facet === "watchStates" && options.watchStates.length === 0) continue;
    for (const value of selection.include) {
      chips.push({
        key: `${facet}:+${value}`,
        label: value,
        tone: "include",
        clear: () =>
          setFacet(facet, { ...selection, include: selection.include.filter((v) => v !== value) }),
      });
    }
    for (const value of selection.exclude) {
      chips.push({
        key: `${facet}:-${value}`,
        label: value,
        tone: "exclude",
        clear: () =>
          setFacet(facet, { ...selection, exclude: selection.exclude.filter((v) => v !== value) }),
      });
    }
  }
  if (filters.minimumRating > 0) {
    chips.push({
      key: "rating",
      label: `التقييم ${filters.minimumRating}+`,
      tone: "range",
      clear: () => onChange((current) => ({ ...current, minimumRating: 0 })),
    });
  }
  for (const criterion of scoreCriteria) {
    const minimum = filters.minimumScores[criterion];
    if (minimum === undefined) continue;
    chips.push({
      key: `score:${criterion}`,
      label: `${scoreCriterionLabels[criterion].ar} ${minimum}+`,
      tone: "range",
      clear: () =>
        onChange((current) => ({
          ...current,
          minimumScores: setMinimumScore(current.minimumScores, criterion, 0),
        })),
    });
  }
  if (filters.yearFrom !== null || filters.yearTo !== null) {
    chips.push({
      key: "year",
      label:
        filters.yearFrom !== null && filters.yearTo !== null
          ? `${filters.yearFrom}–${filters.yearTo}`
          : filters.yearFrom !== null
            ? `من ${filters.yearFrom}`
            : `حتى ${filters.yearTo}`,
      tone: "range",
      clear: () => onChange((current) => ({ ...current, yearFrom: null, yearTo: null })),
    });
  }
  if (filters.privacy !== "public") {
    chips.push({
      key: "privacy",
      label: filters.privacy === "all" ? "العامة والخاصة" : "الخاصة فقط",
      tone: "range",
      clear: () => onChange((current) => ({ ...current, privacy: "public" })),
    });
  }

  if (!chips.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="المرشحات النشطة">
      {chips.map((chip) => (
        <li key={chip.key}>
          <ActiveChip {...chip} />
        </li>
      ))}
    </ul>
  );
}

function ActiveChip({
  label,
  tone,
  clear,
}: {
  label: string;
  tone: "include" | "exclude" | "range";
  clear: () => void;
}) {
  // Facet values are raw ids/English labels; the same lookup the facet chips use makes them
  // readable here. Range chips already carry a finished Arabic label.
  const text =
    tone === "range"
      ? label
      : (fixedLabels[label] ?? kindLabelsAr[label as keyof typeof kindLabelsAr] ?? label);
  return (
    <button
      type="button"
      onClick={clear}
      aria-label={`إزالة المرشح: ${text}`}
      className={cn(
        "group/chip inline-flex h-6 items-center gap-1 rounded-full border ps-2 pe-1 text-[11px] font-medium",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        tone === "exclude"
          ? "border-destructive/30 bg-destructive/8 text-destructive hover:bg-destructive/15"
          : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
      )}
    >
      {tone === "exclude" ? <MinusIcon className="size-3" weight="bold" /> : null}
      <span className="max-w-40 truncate">{text}</span>
      <XIcon className="size-3 opacity-60 transition-opacity group-hover/chip:opacity-100" />
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/* Body                                                                      */
/* ----------------------------------------------------------------------- */

function CatalogFilterContent(props: CatalogFiltersProps) {
  const { filters, onChange, options } = props;
  const updateFacet = (key: CatalogFacetKey, value: string) =>
    onChange((current) => ({
      ...current,
      facets: { ...current.facets, [key]: cycleCatalogSelection(current.facets[key], value) },
    }));
  const facet = (key: CatalogFacetKey, searchable = false) => (
    <FacetSection
      key={key}
      facet={key}
      options={options[key]}
      filters={filters}
      onCycle={updateFacet}
      searchable={searchable}
    />
  );
  const hasAwards = options.awardPrograms.length > 0;
  const hasMakers = options.studios.length > 0 || options.contributors.length > 0;

  return (
    <div className="flex flex-col gap-7 px-5 pb-6 pt-5">
      <WatchSection {...props} />

      <Group title="العمل والإصدار">
        {facet("kinds")}
        {facet("releaseStatuses")}
        {options.structureStates.length > 1 ? facet("structureStates") : null}
      </Group>

      <Group title="التقييم">
        {facet("ratingStates")}
        <RatingSection {...props} />
      </Group>

      <Group title="التصنيفات">
        {facet("genres", true)}
        {facet("tones", true)}
        {facet("tags", true)}
      </Group>

      <Group title="إرشادات المحتوى">
        {facet("audiences")}
        {facet("ages")}
        {facet("warningStates")}
        {facet("sexualityRisks")}
        {facet("behavioralRisks")}
        {facet("theologyRisks")}
      </Group>

      {hasAwards ? (
        <Group title="الجوائز">
          {facet("awardPrograms", true)}
          {facet("awardResults")}
          {facet("awardCategories", true)}
        </Group>
      ) : null}

      <Group title="الزمن والمنشأ">
        <YearRange {...props} />
        {facet("countries", true)}
      </Group>

      {hasMakers ? (
        <Group title="صنّاع العمل">
          {facet("studios", true)}
          {facet("contributors", true)}
        </Group>
      ) : null}

      {props.allowPrivacy ? (
        <Group title="الخصوصية" hint="متاح لحساب المدير فقط">
          <ToggleGroup
            value={[filters.privacy]}
            multiple={false}
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
            aria-label="عرض الأعمال الخاصة"
            onValueChange={(values) => {
              const privacy = values[0] as CatalogFilterState["privacy"] | undefined;
              if (privacy) onChange((current) => ({ ...current, privacy }));
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
        </Group>
      ) : null}

      <p className="text-[11px] leading-5 text-muted-foreground">
        اضغط قيمةً مرة لتضمينها، ومرة أخرى لاستبعادها، وثالثة لإلغاء الاختيار.
      </p>
    </div>
  );
}

/** A titled run of related facets. Always open — the section heading is a landmark, not a door. */
function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function FacetLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

/* ----------------------------------------------------------------------- */
/* Watch state + playable                                                    */
/* ----------------------------------------------------------------------- */

/**
 * The two personal switches, first because they are the ones a family member reaches for most:
 * "what haven't I seen" as a single-choice segmented control (a tri-state chip cycle is the wrong
 * tool for a three-way exclusive state), and "playable only" as a plain switch — it is a yes/no,
 * and it is on by default, so it needs to read as a setting rather than as a chosen filter.
 */
function WatchSection({ filters, onChange, options }: CatalogFiltersProps) {
  const playableId = useId();
  const counts = new Map(options.watchStates.map((option) => [option.value, option.count]));
  const hasWatch = options.watchStates.length > 0;
  const hasPlayable = options.playableStates.length > 1;
  if (!hasWatch && !hasPlayable) return null;

  const selected = filters.facets.watchStates.include[0] ?? "all";
  const playableOnly = isDefaultPlayableSelection(filters.facets.playableStates);
  const notPlayableCount =
    options.playableStates.find((option) => option.value === "not-playable")?.count ?? 0;

  return (
    <section className="flex flex-col gap-4">
      {hasWatch ? (
        <div className="flex flex-col gap-2">
          <FacetLabel>المشاهدة</FacetLabel>
          <ToggleGroup
            value={[selected]}
            multiple={false}
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
            aria-label="تصفية حسب حالة المشاهدة"
            onValueChange={(values) => {
              const next = values[0];
              if (!next) return;
              onChange((current) => ({
                ...current,
                facets: {
                  ...current.facets,
                  watchStates: { include: next === "all" ? [] : [next], exclude: [] },
                },
              }));
            }}
          >
            <ToggleGroupItem value="all" className="flex-3 text-xs">
              الكل
            </ToggleGroupItem>
            {watchStateOrder.map((state) => (
              <ToggleGroupItem key={state} value={state} className={cn("flex-4 gap-1.5 text-xs")}>
                {fixedLabels[state]}
                <span className="text-[10px] tabular-nums opacity-60">
                  {counts.get(state) ?? 0}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}

      {hasPlayable ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <Label htmlFor={playableId} className="text-sm font-medium">
              القابل للتشغيل فقط
            </Label>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              يُخفي ما لم يُربط بمصدر تشغيل بعد ({notPlayableCount})
            </p>
          </div>
          <Switch
            id={playableId}
            checked={playableOnly}
            onCheckedChange={(checked) =>
              onChange((current) => ({
                ...current,
                facets: {
                  ...current.facets,
                  playableStates: checked
                    ? createCatalogFilters().facets.playableStates
                    : { include: [], exclude: [] },
                },
              }))
            }
          />
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Facet chips                                                               */
/* ----------------------------------------------------------------------- */

/**
 * One facet as a wrap of tri-state chips. Long facets fold: the first dozen (with anything already
 * selected pulled to the front so a choice is never hidden) and a "+N" chip that opens the rest in
 * place — no inner scrollbox, the drawer's own scroll is the only one. Really long lists get a
 * search field once opened.
 */
function FacetSection({
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
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const labelFor = useFacetLabel(facet);
  if (!options.length) return null;

  const selection = filters.facets[facet];
  const modeOf = (value: string) =>
    selection.include.includes(value)
      ? "include"
      : selection.exclude.includes(value)
        ? "exclude"
        : null;

  const needle = query.trim().toLocaleLowerCase();
  const searched = needle
    ? options.filter((option) => labelFor(option.value).toLocaleLowerCase().includes(needle))
    : options;
  const folds = options.length > FACET_PREVIEW;
  let visible = searched;
  if (folds && !expanded && !needle) {
    const chosen = options.filter((option) => modeOf(option.value) !== null);
    const rest = options.filter((option) => modeOf(option.value) === null);
    visible = [...chosen, ...rest].slice(0, Math.max(FACET_PREVIEW, chosen.length));
  }
  const hiddenCount = options.length - visible.length;

  return (
    <div className="flex flex-col gap-2">
      <FacetLabel>{facetLabels[facet]}</FacetLabel>
      {searchable && expanded && options.length > FACET_SEARCH_THRESHOLD ? (
        <InputGroup className="h-8">
          <InputGroupAddon>
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`ابحث في ${facetLabels[facet]}…`}
            aria-label={`البحث داخل ${facetLabels[facet]}`}
            className="h-8 text-xs"
          />
        </InputGroup>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {visible.map((option) => (
          <FacetChip
            key={option.value}
            label={labelFor(option.value)}
            count={option.count}
            mode={modeOf(option.value)}
            onClick={() => onCycle(facet, option.value)}
          />
        ))}
        {folds && !needle ? (
          <button
            type="button"
            onClick={() => {
              setExpanded((value) => !value);
              if (expanded) setQuery("");
            }}
            aria-expanded={expanded}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs",
              "text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <CaretDownIcon
              className={cn("size-3 transition-transform", expanded && "rotate-180")}
            />
            {expanded ? "عرض أقل" : `+${hiddenCount} أخرى`}
          </button>
        ) : null}
        {needle && !visible.length ? (
          <p className="text-xs text-muted-foreground">لا توجد خيارات مطابقة.</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Off / include / exclude in one control, kept quiet: include is a primary tint with a plus,
 * exclude is a destructive tint with a minus — never a solid red button. The count is part of the
 * chip because "how many results would this leave" is the whole reason to look at a facet.
 */
function FacetChip({
  label,
  count,
  mode,
  onClick,
}: {
  label: string;
  count: number;
  mode: "include" | "exclude" | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={mode !== null}
      aria-label={`${label}: ${mode === "include" ? "مضمّن" : mode === "exclude" ? "مستبعَد" : "غير محدد"}`}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1 rounded-full border px-2.5 text-xs font-medium",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        mode === null && "border-border/70 bg-background/40 text-foreground/85 hover:bg-muted",
        mode === "include" &&
          "border-primary/40 bg-primary/12 text-primary hover:bg-primary/20 dark:bg-primary/18",
        mode === "exclude" &&
          "border-destructive/35 bg-destructive/8 text-destructive hover:bg-destructive/15",
      )}
    >
      {mode === "include" ? <PlusIcon weight="bold" className="size-3 shrink-0" /> : null}
      {mode === "exclude" ? <MinusIcon weight="bold" className="size-3 shrink-0" /> : null}
      <span className="truncate">{label}</span>
      <span className="text-[10px] tabular-nums opacity-55">{count}</span>
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/* Rating + years                                                            */
/* ----------------------------------------------------------------------- */

function RatingSection({ filters, onChange }: CatalogFiltersProps) {
  const activeCriteria = scoreCriteria.filter((criterion) => filters.minimumScores[criterion]);
  const [showCriteria, setShowCriteria] = useState(activeCriteria.length > 0);
  return (
    <div className="flex flex-col gap-4">
      <ScoreSlider
        label="الحد الأدنى للتقييم العام"
        value={filters.minimumRating}
        onChange={(minimumRating) => onChange((current) => ({ ...current, minimumRating }))}
      />
      <button
        type="button"
        onClick={() => setShowCriteria((value) => !value)}
        aria-expanded={showCriteria}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <CaretDownIcon
          className={cn("size-3 transition-transform", showCriteria && "rotate-180")}
        />
        المعايير التفصيلية
        {activeCriteria.length ? (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {activeCriteria.length}
          </Badge>
        ) : null}
      </button>
      {showCriteria ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-muted/20 p-4">
          {scoreCriteria.map((criterion) => (
            <ScoreSlider
              key={criterion}
              label={scoreCriterionLabels[criterion].ar}
              value={filters.minimumScores[criterion] ?? 0}
              onChange={(value) =>
                onChange((current) => ({
                  ...current,
                  minimumScores: setMinimumScore(current.minimumScores, criterion, value),
                }))
              }
            />
          ))}
          <p className="text-[11px] leading-5 text-muted-foreground">
            في العناوين المتعددة، كل معيار هو متوسط درجات المواسم أو الإصدارات المسجّلة.
          </p>
        </div>
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">
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
    </div>
  );
}

function YearRange({ filters, onChange }: CatalogFiltersProps) {
  const fromId = useId();
  const toId = useId();
  const setYear = (key: "yearFrom" | "yearTo", raw: string) =>
    onChange((current) => ({ ...current, [key]: raw ? Number(raw) : null }));
  return (
    <div className="flex flex-col gap-2">
      <FacetLabel>سنة الإصدار</FacetLabel>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Input
          id={fromId}
          type="number"
          inputMode="numeric"
          aria-label="من سنة"
          value={filters.yearFrom ?? ""}
          placeholder="من"
          className="h-9 text-center tabular-nums"
          onChange={(event) => setYear("yearFrom", event.target.value)}
        />
        <span className="text-muted-foreground" aria-hidden="true">
          –
        </span>
        <Input
          id={toId}
          type="number"
          inputMode="numeric"
          aria-label="إلى سنة"
          value={filters.yearTo ?? ""}
          placeholder="إلى"
          className="h-9 text-center tabular-nums"
          onChange={(event) => setYear("yearTo", event.target.value)}
        />
      </div>
    </div>
  );
}
