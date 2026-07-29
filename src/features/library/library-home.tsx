import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookmarkSimpleIcon,
  CalendarBlankIcon,
  ChartDonutIcon,
  GridFourIcon,
  SquaresFourIcon,
  TableIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSavedViews, getWorks } from "@/server/library.functions"
import { cn } from "@/lib/utils"
import { libraryCollections, workBelongsToCollection } from "./collections"
import type { LibraryCollection } from "./collections"
import { normalizeFacetFilters, workMatchesFilters } from "./filtering"
import type { SavedUserView, Work } from "./model"
import { LibraryHeader } from "./components/library-header"

const layoutMeta = {
  gallery: { label: "معرض", icon: GridFourIcon },
  table: { label: "جدول", icon: TableIcon },
  timeline: { label: "خط زمني", icon: CalendarBlankIcon },
  statistics: { label: "إحصاءات", icon: ChartDonutIcon },
} as const

const showcaseCoverClasses = [
  "right-0 -translate-y-1/2 -rotate-6 group-hover/showcase:translate-x-8 group-hover/showcase:-translate-y-[62%] group-hover/showcase:-rotate-12",
  "right-16 -translate-y-1/2 -rotate-3 group-hover/showcase:translate-x-4 group-hover/showcase:-translate-y-[54%] group-hover/showcase:-rotate-6",
  "right-32 -translate-y-1/2 group-hover/showcase:-translate-y-[46%]",
  "right-48 -translate-y-1/2 rotate-3 group-hover/showcase:-translate-x-4 group-hover/showcase:-translate-y-[55%] group-hover/showcase:rotate-7",
  "right-64 -translate-y-1/2 rotate-6 group-hover/showcase:-translate-x-8 group-hover/showcase:-translate-y-[63%] group-hover/showcase:rotate-12",
] as const

function stableWorkOrder(id: string) {
  let hash = 0
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return hash
}

export function LibraryHome() {
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  })
  const { data: savedViews } = useSuspenseQuery({
    queryKey: ["saved-views"],
    queryFn: () => getSavedViews(),
  })

  const summary = useMemo(
    () => ({
      total: works.length,
      active: works.filter((work) => work.status === "in-progress").length,
      completed: works.filter((work) => work.status === "completed").length,
      favorites: works.filter((work) => work.favorite).length,
    }),
    [works]
  )
  const recentWorks = useMemo(
    () =>
      [...works]
        .sort((left, right) => right.addedAt - left.addedAt)
        .slice(0, 7),
    [works]
  )
  const showcaseWorks = useMemo(
    () =>
      [...works]
        .filter((work) => work.imagePath && work.calculatedRating !== null)
        .sort(
          (left, right) =>
            (right.calculatedRating ?? 0) - (left.calculatedRating ?? 0)
        )
        .slice(0, 25)
        .sort(
          (left, right) => stableWorkOrder(left.id) - stableWorkOrder(right.id)
        )
        .slice(0, 5),
    [works]
  )

  return (
    <div className="min-h-screen bg-background">
      <LibraryHeader />
      <main className="mx-auto flex max-w-[1500px] flex-col gap-12 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="relative isolate overflow-hidden rounded-3xl border border-border bg-card px-6 py-8 sm:px-9 sm:py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-10 lg:px-12 lg:py-12">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-5 flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              <p className="text-xs font-medium text-muted-foreground">
                أرشيفك الشخصي · {summary.total} عمل
              </p>
            </div>
            <h1 className="text-4xl leading-[1.12] font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
              مكتبة واحدة لكل العوالم التي مررت بها.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              افتح مجموعة أو عرضاً محفوظاً، ثم واصل من حيث توقفت. كل سجل يحتفظ
              بالتقييم والتقدم والتفاصيل والعلاقات في مكان واحد.
            </p>
            <Link
              to="/library/$collection"
              params={{ collection: "all" }}
              search={{ view: "all" }}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-7 rounded-full px-5"
              )}
            >
              <SquaresFourIcon data-icon="inline-start" />
              افتح المكتبة كاملة
              <span className="text-primary-foreground/70">{summary.total}</span>
              <ArrowLeftIcon data-icon="inline-end" />
            </Link>

            <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-4 border-t border-border/70 pt-6">
              <SummaryItem label="قيد المتابعة" value={summary.active} tone="primary" />
              <SummaryItem label="مكتمل" value={summary.completed} tone="emerald" />
              <SummaryItem label="في المفضلة" value={summary.favorites} tone="amber" />
            </dl>
          </div>

          <div
            className="group/showcase relative mt-10 hidden h-72 lg:block"
            aria-hidden="true"
          >
            {showcaseWorks.map((work, index) => (
              <div
                key={work.id}
                className={cn(
                  "absolute top-1/2 aspect-2/3 w-36 overflow-hidden rounded-xl bg-muted shadow-2xl ring-1 ring-black/10",
                  "transition-all duration-300 ease-out motion-reduce:transition-none",
                  "group-hover/showcase:blur-[1.5px] group-hover/showcase:brightness-75 group-hover/showcase:saturate-75",
                  "hover:z-20! hover:scale-110! hover:blur-none! hover:brightness-100! hover:saturate-100!",
                  showcaseCoverClasses[index]
                )}
                style={{ zIndex: 10 - index }}
              >
                {work.imagePath ? (
                  <img
                    src={work.imagePath}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col justify-end bg-gradient-to-t from-black/80 via-black/10 to-transparent p-3">
                    <span className="text-xs font-semibold text-white">
                      {work.arabicTitle || work.title}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <HomeSection
          id="collections-heading"
          title="مجموعات المكتبة"
          description="مساحات ثابتة ومرتبة حسب نوع الوسائط."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {libraryCollections
              .filter((collection) => collection.id !== "all")
              .map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  works={works.filter((work) =>
                    workBelongsToCollection(work, collection)
                  )}
                />
              ))}
          </div>
        </HomeSection>

        <HomeSection
          id="saved-views-heading"
          title="عروضك المحفوظة"
          description="اختصارات حية تحفظ الفلاتر والترتيب وطريقة العرض."
          badge={savedViews.length ? `${savedViews.length}` : undefined}
        >
          {savedViews.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {savedViews.map((savedView) => (
                <SavedViewCard
                  key={savedView.id}
                  view={savedView}
                  works={works}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed bg-muted/20 py-10 text-center">
              <CardContent>
                <BookmarkSimpleIcon
                  className="mx-auto size-8 text-muted-foreground"
                  weight="duotone"
                />
                <p className="mt-3 text-sm font-medium">
                  لا توجد عروض محفوظة بعد
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  افتح أي مجموعة واضبطها، ثم احفظ العرض من شريط الأدوات.
                </p>
              </CardContent>
            </Card>
          )}
        </HomeSection>

        <HomeSection
          id="recent-heading"
          title="أضيفت حديثاً"
          description="آخر السجلات التي دخلت إلى الأرشيف."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {recentWorks.map((work) => (
              <Link
                key={work.id}
                to="/library/$collection"
                params={{ collection: "all" }}
                search={{ view: "all", work: work.id }}
                className="group min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-foreground/10 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                  {work.imagePath ? (
                    <img
                      src={work.imagePath}
                      alt=""
                      className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex size-full items-end bg-gradient-to-br from-muted to-muted/60 p-3">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {work.arabicTitle || work.title}
                      </span>
                    </div>
                  )}
                  {work.calculatedRating ? (
                    <span className="absolute end-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      {work.calculatedRating.toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-xs font-medium">
                  {work.arabicTitle || work.title}
                </p>
              </Link>
            ))}
          </div>
        </HomeSection>
      </main>
    </div>
  )
}

function HomeSection({
  id,
  title,
  description,
  badge,
  children,
}: {
  id: string
  title: string
  description: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id={id} className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {badge && <Badge variant="secondary">{badge}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "primary" | "emerald" | "amber"
}) {
  const dot = {
    primary: "bg-primary",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  }[tone]

  return (
    <div className="min-w-24 flex-1 border-e border-border/70 pe-8 last:border-e-0 last:pe-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </dd>
    </div>
  )
}

function CollectionCard({
  collection,
  works,
}: {
  collection: LibraryCollection
  works: Work[]
}) {
  const Icon = collection.icon
  const covers = works
    .filter((work) => work.imagePath)
    .sort(
      (left, right) =>
        (right.calculatedRating ?? 0) - (left.calculatedRating ?? 0)
    )
    .slice(0, 3)

  return (
    <Link
      to="/library/$collection"
      params={{ collection: collection.id }}
      search={{ view: "all" }}
      className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <Card className="h-full overflow-hidden py-0 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-foreground/10">
        {/* Poster shelf */}
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-muted/30">
          {covers.length > 0 ? (
            <div className="flex items-end justify-center [direction:ltr]">
              {covers.map((work, i) => (
                <div
                  key={work.id}
                  style={
                    {
                      "--rotate": `${(i - 1) * 10}deg`,
                      "--spread": `${(i - 1) * 12}px`,
                      marginInlineStart: i === 0 ? 0 : 0,
                      zIndex: i === 1 ? 3 : i,
                      transitionDelay: `${i * 15}ms`,
                    } as React.CSSProperties
                  }
                  className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted shadow-md ring-1 ring-black/5 transition-[transform,box-shadow] duration-300 ease-out [transform:rotate(var(--rotate))] group-hover:shadow-lg group-hover:[transform:translate(var(--spread),10px)_rotate(0deg)]"
                >
                  <img src={work.imagePath!} alt="" className="size-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <Icon weight="duotone" className="size-10 text-muted-foreground/40" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
        </div>

        <CardHeader className="pt-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon weight="duotone" />
            </span>
            {collection.title}
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {collection.description}
          </CardDescription>
          <CardAction>
            <ArrowLeftIcon className="text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-foreground" />
          </CardAction>
        </CardHeader>

        <CardFooter className="justify-between pb-5 text-muted-foreground">
          <span className="text-xs">{collection.eyebrow}</span>
          <Badge variant="secondary">{works.length} عمل</Badge>
        </CardFooter>
      </Card>
    </Link>
  )
}

function SavedViewCard({
  view,
  works,
}: {
  view: SavedUserView
  works: Work[]
}) {
  const meta = layoutMeta[view.layout]
  const LayoutIcon = meta.icon

  const matchingWorks = works.filter((work) => {
    const normalizedSearch = view.search.trim().toLocaleLowerCase()
    const matchesSearch =
      !normalizedSearch ||
      [
        work.title,
        work.arabicTitle ?? "",
        work.creator,
        ...work.tags,
        ...work.genres,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedSearch)
    return (
      matchesSearch &&
      workMatchesFilters(work, {
        kinds: view.kinds,
        excludedKinds: view.excludedKinds,
        statuses: view.statuses,
        excludedStatuses: view.excludedStatuses,
        minRating: view.minRating,
        minScores: view.minScores,
        favoriteOnly: view.favoriteOnly,
        yearFrom: view.yearFrom,
        yearTo: view.yearTo,
        facets: normalizeFacetFilters(view.facets),
      })
    )
  })

  const covers = matchingWorks
    .filter((work) => work.imagePath)
    .sort((left, right) => (right.calculatedRating ?? 0) - (left.calculatedRating ?? 0))
    .slice(0, 8)
  const overflow = matchingWorks.length - covers.length

  return (
    <Link
      to="/library/$collection"
      params={{ collection: "all" }}
      search={{ view: "all", saved: view.id }}
      className="group/card relative block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        size="sm"
        className="relative z-0 h-full transition-[transform,box-shadow] duration-300 group-hover/card:z-20 group-hover/card:-translate-y-0.5 group-hover/card:shadow-xl"
      >
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookmarkSimpleIcon weight="fill" />
            </span>
            <span className="truncate">{view.name}</span>
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <span className="font-medium text-foreground/80">
              {matchingWorks.length}
            </span>
            نتيجة
            <span className="text-border">·</span>
            <LayoutIcon className="size-3.5" weight="duotone" />
            {meta.label}
          </CardDescription>
          <CardAction>
            <ArrowLeftIcon className="text-muted-foreground transition-transform group-hover/card:-translate-x-1" />
          </CardAction>
        </CardHeader>

        <CardContent className="overflow-visible">
          {covers.length > 0 ? (
            <div className="flex h-20 items-center [direction:ltr]">
              {covers.map((work, i) => (
                <div
                  key={work.id}
                  style={
                    {
                      "--shift": `${i > 1 ? i * 22 : 11}px`,
                      marginInlineStart: i === 0 ? 0 : -30,
                      zIndex: covers.length - i,
                      transitionDelay: `${i * 18}ms`,
                    } as React.CSSProperties
                  }
                  className="relative aspect-2/3 h-20 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm ring-2 ring-card transition-[transform,height] duration-300 ease-out group-hover/card:h-24 group-hover/card:[transform:translateX(var(--shift))]"
                >
                  <img
                    src={work.imagePath!}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
              ))}
              {overflow > 0 ? (
                <div
                  style={
                    {
                      "--shift": `${covers.length * 22}px`,
                      marginInlineStart: -30,
                      transitionDelay: `${covers.length * 18}ms`,
                    } as React.CSSProperties
                  }
                  className="relative flex aspect-2/3 h-20 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card transition-[transform,height] duration-300 ease-out group-hover/card:h-24 group-hover/card:[transform:translateX(var(--shift))]"
                >
                  +{overflow}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-20 items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 text-xs text-muted-foreground">
              <LayoutIcon className="size-4 shrink-0" weight="duotone" />
              لا توجد نتائج مطابقة حالياً
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
