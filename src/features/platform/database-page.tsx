import {
  DatabaseIcon,
  FunnelSimpleIcon,
  ImageIcon,
  ImageSquareIcon,
  MagnifyingGlassIcon,
  PanoramaIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { kindLabels } from "@/features/library/filtering";
import type { Work, WorkKind } from "@/features/library/model";
import { useArabicTranslations } from "@/features/library/translations";
import { getPlatformCatalogWorks } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

type CatalogView = "poster" | "banner" | "logo";
type CatalogSort = "added" | "newest" | "oldest" | "ranked";

const catalogKinds: WorkKind[] = ["movie", "series", "anime"];
const audienceOptions = [
  { value: "General", label: "عام" },
  { value: "Teen", label: "مراهقون" },
  { value: "Young Adult", label: "شباب" },
  { value: "Adult", label: "بالغون" },
] as const;

function matchesQuery(work: Work, query: string) {
  if (!query) return true;
  return [
    work.title,
    work.arabicTitle ?? "",
    work.creator,
    ...work.aliases,
    ...work.tags,
    ...work.genres,
    ...work.studios,
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

function releaseTimestamp(work: Work) {
  const exact = work.releaseStart ? Date.parse(`${work.releaseStart}T00:00:00Z`) : Number.NaN;
  return Number.isFinite(exact) ? exact : (work.year ?? 0) * 31_536_000_000;
}

function sortWorks(works: Work[], sort: CatalogSort) {
  return [...works].sort((left, right) => {
    if (sort === "ranked") {
      return (
        (right.calculatedRating ?? -1) - (left.calculatedRating ?? -1) ||
        right.addedAt - left.addedAt
      );
    }
    if (sort === "added") return right.addedAt - left.addedAt;
    const comparison = releaseTimestamp(left) - releaseTimestamp(right);
    return (sort === "newest" ? -comparison : comparison) || right.addedAt - left.addedAt;
  });
}

export function DatabasePage() {
  const { data: works } = useSuspenseQuery({
    queryKey: ["platform-catalog", "screen-only"],
    queryFn: () => getPlatformCatalogWorks(),
  });
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<WorkKind[]>([]);
  const [audiences, setAudiences] = useState<Array<NonNullable<Work["audience"]>>>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [minimumRating, setMinimumRating] = useState(0);
  const [sort, setSort] = useState<CatalogSort>("added");
  const [view, setView] = useState<CatalogView>("poster");

  const catalogWorks = useMemo(
    () => works.filter((work) => catalogKinds.includes(work.kind)),
    [works],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const genreOptions = useMemo(
    () =>
      [...new Set(catalogWorks.flatMap((work) => work.genres))].sort((left, right) =>
        left.localeCompare(right, "ar"),
      ),
    [catalogWorks],
  );
  const visibleWorks = useMemo(
    () =>
      sortWorks(
        catalogWorks.filter(
          (work) =>
            matchesQuery(work, normalizedQuery) &&
            (!kinds.length || kinds.includes(work.kind)) &&
            (!audiences.length || (work.audience !== null && audiences.includes(work.audience))) &&
            (!genres.length || genres.some((genre) => work.genres.includes(genre))) &&
            (work.calculatedRating ?? 0) >= minimumRating,
        ),
        sort,
      ),
    [audiences, catalogWorks, genres, kinds, minimumRating, normalizedQuery, sort],
  );

  const clearFilters = () => {
    setQuery("");
    setKinds([]);
    setAudiences([]);
    setGenres([]);
    setMinimumRating(0);
  };
  const activeFilterCount =
    Number(Boolean(query)) +
    kinds.length +
    audiences.length +
    genres.length +
    Number(minimumRating > 0);

  return (
    <PlatformShell immersive>
      <section className="relative isolate overflow-hidden border-b border-white/8">
        <div
          className="archive-grid absolute inset-0 -z-10
 opacity-35"
        />
        <div className="absolute inset-x-0 top-0 -z-20 h-72 bg-linear-to-b from-primary/12 to-transparent" />
        <div className="mx-auto max-w-400 px-5 pb-12 pt-28 sm:px-8 sm:pt-36">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">أرشيف نحّاسينما</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
            قاعدة البيانات
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-9 text-foreground/75">
            أفلام ومسلسلات وأنمي، في مساحة واحدة قابلة للاستكشاف.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-400 px-5 pb-28 pt-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {visibleWorks.length} من {catalogWorks.length} عمل
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon data-icon="inline-start" />
                مسح المرشحات
              </Button>
            )}
            <CatalogFilterDialog
              query={query}
              onQueryChange={setQuery}
              kinds={kinds}
              onKindsChange={setKinds}
              audiences={audiences}
              onAudiencesChange={setAudiences}
              genres={genres}
              onGenresChange={setGenres}
              genreOptions={genreOptions}
              minimumRating={minimumRating}
              onMinimumRatingChange={setMinimumRating}
              activeFilterCount={activeFilterCount}
              onClear={clearFilters}
            />
            <FilterRow label="العرض">
              <ToggleGroup
                value={[view]}
                multiple={false}
                variant="outline"
                size="default"
                spacing={0}
                aria-label="طريقة عرض الأعمال"
                onValueChange={(values) => {
                  const next = values[0] as CatalogView | undefined;
                  if (next) setView(next);
                }}
              >
                <ToggleGroupItem value="poster" className={"w-0!"}>
                  <ImageIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="banner" className={"w-0!"}>
                  <PanoramaIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="logo" className={"w-0!"}>
                  <ImageSquareIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </FilterRow>
            <FilterRow label="الترتيب">
              <ToggleGroup
                value={[sort]}
                multiple={false}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="ترتيب الأعمال"
                onValueChange={(values) => {
                  const next = values[0] as CatalogSort | undefined;
                  if (next) setSort(next);
                }}
              >
                <ToggleGroupItem value="added">الجديد</ToggleGroupItem>
                <ToggleGroupItem value="newest">الأحدث</ToggleGroupItem>
                <ToggleGroupItem value="oldest">الأقدم</ToggleGroupItem>
                <ToggleGroupItem value="ranked">التقييم</ToggleGroupItem>
              </ToggleGroup>
            </FilterRow>
          </div>
        </div>

        {visibleWorks.length ? (
          <div
            className={
              view === "banner"
                ? "grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
            }
          >
            {visibleWorks.map((work) => (
              <WorkCard key={work.id} work={work} variant={view} />
            ))}
          </div>
        ) : (
          <Empty className="min-h-80 border border-dashed border-white/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <DatabaseIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
              <EmptyDescription>جرّب توسيع البحث أو إزالة بعض المرشحات.</EmptyDescription>
            </EmptyHeader>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                مسح المرشحات
              </Button>
            )}
          </Empty>
        )}
      </section>
    </PlatformShell>
  );
}

function CatalogFilterDialog({
  query,
  onQueryChange,
  kinds,
  onKindsChange,
  audiences,
  onAudiencesChange,
  genres,
  onGenresChange,
  genreOptions,
  minimumRating,
  onMinimumRatingChange,
  activeFilterCount,
  onClear,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  kinds: WorkKind[];
  onKindsChange: (values: WorkKind[]) => void;
  audiences: Array<NonNullable<Work["audience"]>>;
  onAudiencesChange: (values: Array<NonNullable<Work["audience"]>>) => void;
  genres: string[];
  onGenresChange: (values: string[]) => void;
  genreOptions: string[];
  minimumRating: number;
  onMinimumRatingChange: (value: number) => void;
  activeFilterCount: number;
  onClear: () => void;
}) {
  const { taxonomyLabel } = useArabicTranslations();

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant={activeFilterCount ? "secondary" : "outline"} size="sm">
            <FunnelSimpleIcon data-icon="inline-start" />
            مرشحات{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
        }
      />
      <DialogContent
        className="max-h-[calc(
100svh-2rem)] max-w-2xl gap-0 overflow-y-auto bg-background p-0 sm:max-w-2xl"
        dir="rtl"
      >
        <DialogHeader className="border-b border-white/8 px-6 py-5">
          <DialogTitle className="text-xl">است كشف المكتبة</DialogTitle>
          <DialogDescription>اختر إشارات بسيطة لتضييق النتائج من دون تعقيد.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-7 px-6 py-6">
          <InputGroup className="h-11 bg-muted/35">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="ابحث بالعنوان، الصانع، النوع أو الوسم…"
              aria-label="البحث في قاعدة البيانات"
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => onQueryChange("")}
                  aria-label="مسح البحث"
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          <FilterSection title="النوع" description="اختر نوعاً واحداً أو أكثر">
            <ToggleGroup
              value={kinds}
              multiple
              variant="outline"
              size="sm"
              className="flex-wrap"
              aria-label="أنواع الأعمال"
              onValueChange={(values) =>
                onKindsChange(
                  values.filter((value): value is WorkKind =>
                    catalogKinds.includes(value as WorkKind),
                  ),
                )
              }
            >
              {catalogKinds.map((kind) => (
                <ToggleGroupItem key={kind} value={kind}>
                  {kindLabels[kind]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterSection>

          <FilterSection title="الجمهور" description="التصنيف العمري المسجل للعمل">
            <ToggleGroup
              value={audiences}
              multiple
              variant="outline"
              size="sm"
              className="flex-wrap"
              aria-label="الفئة العمرية"
              onValueChange={(values) =>
                onAudiencesChange(
                  values.filter((value): value is NonNullable<Work["audience"]> =>
                    audienceOptions.some((option) => option.value === value),
                  ),
                )
              }
            >
              {audienceOptions.map((audience) => (
                <ToggleGroupItem key={audience.value} value={audience.value}>
                  {audience.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterSection>

          {genreOptions.length > 0 && (
            <FilterSection title="النوع الفني" description="مثل الخيال، المغامرة أو الدراما">
              <ToggleGroup
                value={genres}
                multiple
                variant="outline"
                size="sm"
                className="flex-wrap"
                aria-label="الأنواع الفنية"
                onValueChange={onGenresChange}
              >
                {genreOptions.map((genre) => (
                  <ToggleGroupItem key={genre} value={genre}>
                    {taxonomyLabel("genre", genre)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FilterSection>
          )}

          <FilterSection
            title="التقييم الأدنى"
            description="تظهر الأعمال غير المقيمة مع خيار الكل فقط"
          >
            <ToggleGroup
              value={[String(minimumRating)]}
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="التقييم الأدنى"
              onValueChange={(values) => {
                const next = Number(values[0]);
                if ([0, 6, 7, 8].includes(next)) onMinimumRatingChange(next);
              }}
            >
              <ToggleGroupItem value="0">الكل</ToggleGroupItem>
              <ToggleGroupItem value="6">+6</ToggleGroupItem>
              <ToggleGroupItem value="7">+7</ToggleGroupItem>
              <ToggleGroupItem value="8">+8</ToggleGroupItem>
            </ToggleGroup>
          </FilterSection>
        </div>

        <DialogFooter className="sticky bottom-0 border-t border-white/8 bg-background px-6 py-4">
          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={onClear}>
              <XIcon data-icon="inline-start" />
              مسح الكل
            </Button>
          )}
          <DialogClose render={<Button />}>عرض النتائج</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-s-2 border-primary/45 ps-4">
      <h3 className="font-heading font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
