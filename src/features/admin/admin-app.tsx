import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BracketsCurlyIcon,
  CheckIcon,
  DatabaseIcon,
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  SelectionAllIcon,
  SparkleIcon,
  TranslateIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { AdvancedFilter } from "@/features/library/filter-sheet"
import {
  buildFacetOptions,
  createEmptyFacetFilters,
  kindLabels,
  workMatchesFilters,
} from "@/features/library/filtering"
import type { WorkFilterState } from "@/features/library/filtering"
import type { Work } from "@/features/library/model"
import {
  progressUnitLabelAr,
  statusLabelsAr,
  useArabicTranslations,
} from "@/features/library/translations"
import { getWorks } from "@/server/library.functions"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WorkEditor } from "./components/editor-form"
import { JsonEditorDialog } from "./components/json-editor"
import { BulkEditDialog } from "./components/bulk-edit"
import { TaxonomyManagerDialog } from "./components/taxonomy-manager"
import { AddWorksDialog } from "./components/add-works-dialog"

function createDefaultFilters(): WorkFilterState {
  return {
    kinds: [],
    excludedKinds: [],
    statuses: [],
    excludedStatuses: [],
    minRating: 0,
    favoriteOnly: false,
    yearFrom: null,
    yearTo: null,
    facets: createEmptyFacetFilters(),
  }
}

function matchesSearch(work: Work, search: string) {
  const query = search.trim().toLocaleLowerCase()
  if (!query) return true
  return [
    work.title,
    work.arabicTitle ?? "",
    work.creator,
    ...work.aliases,
    ...work.genres,
    ...work.tags,
    ...work.studios,
    ...work.credits.flatMap(({ name, role }) => [name, role]),
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query)
}

export function AdminApp() {
  const queryClient = useQueryClient()
  const { taxonomyLabel } = useArabicTranslations()
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  })

  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<WorkFilterState>(createDefaultFilters)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingWork, setEditingWork] = useState<Work | null>(null)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false)
  const [taxonomyOpen, setTaxonomyOpen] = useState(false)

  const facetOptions = useMemo(() => buildFacetOptions(works), [works])
  const visibleWorks = useMemo(
    () =>
      works.filter(
        (work) =>
          matchesSearch(work, search) && workMatchesFilters(work, filters)
      ),
    [filters, search, works]
  )
  const visibleIds = visibleWorks.map((work) => work.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["works"] })
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  return (
    /* FIXED: Added 'h-screen overflow-y-auto' so the page always scrolls vertically */
    <div className="h-screen overflow-y-auto bg-background pb-12 text-foreground antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DatabaseIcon className="size-4" weight="duotone" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs leading-none font-semibold tracking-tight">
                إدارة أركاديا
              </span>
              <span className="mt-1 text-[10px] leading-none text-muted-foreground">
                مساحة قاعدة البيانات المحلية
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              className="h-8 text-xs"
              render={<Link to="/feed">سجل النشاط</Link>}
            />
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              render={
                <Link to="/">
                  <span>العودة إلى المكتبة</span>
                  <ArrowLeftIcon className="size-3.5" />
                </Link>
              }
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-0 px-4 pt-6 sm:px-6">
        {/* Page Heading Section */}
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border/50 bg-card p-5 shadow-2xs md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <SparkleIcon className="size-3.5" />
              <span>صيانة قاعدة البيانات</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">إدارة الأعمال</h1>
            <p className="text-xs text-muted-foreground">
              عدّل البيانات الوصفية والحالة الشخصية دون التأثير في تجربة التصفح.
            </p>
          </div>

          {/* Heading Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTaxonomyOpen(true)}
              className="h-9 gap-1.5 border-border/60 text-xs"
            >
              <TranslateIcon data-icon="inline-start" />
              <span>قاموس التصنيفات</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setJsonEditorOpen(true)}
              className="h-9 gap-1.5 border-border/60 text-xs"
            >
              <BracketsCurlyIcon className="size-3.5 text-muted-foreground" />
              <span>محرر JSON</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkAddOpen(true)}
              className="h-9 gap-1.5 text-xs shadow-xs"
            >
              <PlusIcon className="size-3.5" />
              <span>إضافة أعمال</span>
            </Button>
          </div>
        </div>

        {/* Floating Bulk Selection Toolbar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-14 z-20 mx-auto flex w-[90%] animate-in items-center justify-between gap-4 rounded-b-lg border border-primary/20 bg-primary px-4 py-2 text-primary-foreground shadow-lg fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground">
                <CheckIcon className="size-3 stroke-3" />
              </span>
              <span>
                تم اختيار <strong>{selectedIds.size}</strong>{" "}
                {selectedIds.size === 1 ? "عمل" : "أعمال"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 text-xs text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                مسح
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBulkEditOpen(true)}
                className="h-7 gap-1.5 text-xs shadow-2xs"
              >
                <NotePencilIcon className="size-3.5" />
                <span>تعديل المحدد</span>
              </Button>
            </div>
          </div>
        )}

        {/* Filter and Search Controls Toolbar */}
        <div className="my-2 flex flex-col items-stretch justify-between gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-2xs sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث في العناوين والتصنيفات والوسوم والمساهمين…"
              className="h-9 pr-8 pl-9 text-xs"
              aria-label="البحث في سجلات الإدارة"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="مسح البحث"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AdvancedFilter
              filters={filters}
              facetOptions={facetOptions}
              onChange={setFilters}
              matchingCount={visibleWorks.length}
              title="فلترة سجلات الإدارة"
              triggerLabel="فلاتر متقدمة"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={toggleAllVisible}
              disabled={!visibleWorks.length}
              className="h-9 gap-1.5 border-border/60 text-xs"
            >
              <SelectionAllIcon className="size-3.5 text-muted-foreground" />
              <span>
                {allVisibleSelected ? "إلغاء تحديد الظاهر" : "تحديد الظاهر"}
              </span>
            </Button>

            <Separator
              orientation="vertical"
              className="hidden h-6 bg-border/60 sm:block"
            />

            <div className="px-1 font-mono text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {visibleWorks.length}
              </span>{" "}
              / {works.length}
            </div>
          </div>
        </div>

        {/* Main Data Table Section */}
        {/* FIXED: Replaced 'overflow-hidden' with 'overflow-x-auto' */}
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-2xs">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAllVisible}
                    aria-label="تحديد جميع الأعمال الظاهرة"
                  />
                </TableHead>
                <TableHead className="min-w-55">العمل</TableHead>
                <TableHead className="w-25">النوع</TableHead>
                <TableHead className="w-22.5">الإصدار</TableHead>
                <TableHead className="min-w-45">التصنيفات</TableHead>
                <TableHead className="w-30">المراجعة</TableHead>
                <TableHead className="w-27.5">البنية</TableHead>
                <TableHead className="w-32.5">الحالة</TableHead>
                <TableHead className="w-20 text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleWorks.map((work) => {
                const isSelected = selectedIds.has(work.id)
                return (
                  <TableRow
                    key={work.id}
                    className={cn(
                      "border-border/40 transition-colors",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelected(work.id)}
                        aria-label={`تحديد ${work.arabicTitle || work.title}`}
                      />
                    </TableCell>

                    {/* Work Info Cell */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setEditingWork(work)}
                        className="group flex items-center gap-3 text-left focus-visible:outline-none"
                      >
                        {work.imagePath ? (
                          <img
                            src={work.imagePath}
                            alt=""
                            className="size-10 shrink-0 rounded-md border border-border/40 bg-muted object-cover transition-opacity group-hover:opacity-80"
                          />
                        ) : (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted text-xs font-semibold text-muted-foreground group-hover:bg-muted/80">
                            {work.title.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="flex max-w-60 flex-col gap-0.5 truncate">
                          <span className="truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                            {work.arabicTitle || work.title}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {work.studios.at(0) ?? work.creator}
                          </span>
                        </div>
                      </button>
                    </TableCell>

                    {/* Type Badge */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-border/60 text-[10px] font-medium capitalize"
                      >
                        {kindLabels[work.kind]}
                      </Badge>
                    </TableCell>

                    {/* Release Year */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {work.year ?? "—"}
                    </TableCell>

                    {/* Genres */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {work.genres.slice(0, 2).map((genre) => (
                          <Badge
                            key={genre}
                            variant="secondary"
                            className="bg-muted/60 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                          >
                            {taxonomyLabel("genre", genre)}
                          </Badge>
                        ))}
                        {work.genres.length > 2 && (
                          <span className="self-center font-mono text-[10px] text-muted-foreground/70">
                            +{work.genres.length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          work.curation?.status === "verified"
                            ? "default"
                            : "outline"
                        }
                        className="text-[10px] capitalize"
                      >
                        {taxonomyLabel(
                          "curation-status",
                          work.curation?.status ?? "unreviewed"
                        )}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <strong className="block font-mono font-medium">
                          {work.episodeCount ??
                            work.chapterCount ??
                            work.pageCount ??
                            "—"}
                        </strong>
                        <span className="text-[10px] text-muted-foreground">
                          {work.episodeCount !== null
                            ? progressUnitLabelAr("episodes")
                            : work.chapterCount !== null
                              ? progressUnitLabelAr("chapters")
                              : work.pageCount !== null
                                ? progressUnitLabelAr("pages")
                                : "لا توجد وحدات"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status Indicator Badge */}
                    <TableCell>
                      <StatusBadge status={work.status} />
                    </TableCell>

                    {/* Row Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                            >
                              <DotsThreeVerticalIcon className="size-4" />
                              <span className="sr-only">فتح القائمة</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={() => setEditingWork(work)}
                          >
                            <NotePencilIcon className="mr-2 size-3.5" />
                            تعديل التفاصيل
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Empty Table State */}
          {!visibleWorks.length && (
            <div className="my-4 flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                <DatabaseIcon className="size-6" weight="duotone" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                لا توجد أعمال مطابقة
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                جرّب مسح عبارة البحث أو تعديل الفلاتر الحالية.
              </p>
              {(search || countFiltersActive(filters)) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("")
                    setFilters(createDefaultFilters())
                  }}
                  className="mt-4 h-8 text-xs"
                >
                  مسح الفلاتر
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Editor & Action Dialog Component Mounts */}
      <WorkEditor
        work={editingWork}
        works={works}
        onOpenChange={(open) => !open && setEditingWork(null)}
        onSaved={async () => {
          setEditingWork(null)
          await refresh()
        }}
      />
      <AddWorksDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        onCreated={refresh}
      />
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        workIds={[...selectedIds]}
        onUpdated={async () => {
          setSelectedIds(new Set())
          await refresh()
        }}
      />
      {jsonEditorOpen && (
        <JsonEditorDialog
          open={jsonEditorOpen}
          onOpenChange={setJsonEditorOpen}
          works={works}
          visibleWorks={visibleWorks}
          selectedIds={selectedIds}
          onSaved={refresh}
        />
      )}
      <TaxonomyManagerDialog
        open={taxonomyOpen}
        onOpenChange={setTaxonomyOpen}
      />
    </div>
  )
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: string }) {
  const formattedStatus =
    statusLabelsAr[status as keyof typeof statusLabelsAr] ?? status

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground capitalize">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "completed" && "bg-emerald-500",
          status === "in-progress" && "bg-sky-500",
          status === "planned" && "bg-amber-500",
          status === "dropped" && "bg-rose-500",
          status === "paused" && "bg-purple-500"
        )}
      />
      <span>{formattedStatus}</span>
    </div>
  )
}

function countFiltersActive(filters: WorkFilterState): boolean {
  return Boolean(
    filters.kinds.length ||
    filters.excludedKinds.length ||
    filters.statuses.length ||
    filters.excludedStatuses.length ||
    filters.favoriteOnly ||
    filters.minRating > 0
  )
}
