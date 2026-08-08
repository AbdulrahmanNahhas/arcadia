import {
  ActivityIcon,
  BookmarkSimpleIcon,
  BracketsCurlyIcon,
  BuildingsIcon,
  CheckIcon,
  DatabaseIcon,
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlanetIcon,
  PlusIcon,
  SelectionAllIcon,
  ShieldWarningIcon,
  SignOutIcon,
  TranslateIcon,
  TreeStructureIcon,
  XIcon,
} from "@phosphor-icons/react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdvancedFilter } from "@/features/library/filter-sheet";
import type { WorkFilterState } from "@/features/library/filtering";
import {
  buildFacetOptions,
  createDefaultFilters,
  kindLabels,
  workMatchesFilters,
} from "@/features/library/filtering";
import type { Work } from "@/features/library/model";
import {
  progressUnitLabelAr,
  statusLabelsAr,
  useArabicTranslations,
} from "@/features/library/translations";
import { cn } from "@/lib/utils";
import { getEntities, getWorks } from "@/server/library.functions";
import { getCatalogValidation, getPlanets } from "@/server/platform.functions";
import { AddWorksDialog } from "./components/add-works-dialog";
import { BulkEditDialog } from "./components/bulk-edit";
import { WorkEditor } from "./components/editor-form";
import { EntityManagerDialog } from "./components/entity-manager";
import { JsonEditorDialog } from "./components/json-editor";
import { TaxonomyManagerDialog } from "./components/taxonomy-manager";
import { ViewsManagerDialog } from "./components/views-manager";

function matchesSearch(work: Work, search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [
    work.title,
    work.arabicTitle ?? "",
    work.creator,
    ...work.aliases,
    ...work.genres,
    ...work.tags,
    ...work.studios,
    ...work.contributors.flatMap(({ name, role }) => [name, role]),
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

export function AdminApp() {
  const queryClient = useQueryClient();
  const { taxonomyLabel } = useArabicTranslations();
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const { data: validationIssues } = useSuspenseQuery({
    queryKey: ["catalog-validation"],
    queryFn: () => getCatalogValidation(),
  });
  const { data: planets } = useSuspenseQuery({
    queryKey: ["planets"],
    queryFn: () => getPlanets(),
  });

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<WorkFilterState>(createDefaultFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [viewsManagerOpen, setViewsManagerOpen] = useState(false);
  const [entityManagerOpen, setEntityManagerOpen] = useState(false);

  const facetOptions = useMemo(() => buildFacetOptions(works), [works]);
  const visibleWorks = useMemo(
    () => works.filter((work) => matchesSearch(work, search) && workMatchesFilters(work, filters)),
    [filters, search, works],
  );
  const visibleIds = visibleWorks.map((work) => work.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["works"] }),
      queryClient.invalidateQueries({ queryKey: ["entities"] }),
    ]);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background pb-12 text-foreground antialiased">
      <aside className="fixed inset-y-0 inset-e-0 z-30 hidden w-64 flex-col border-s bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <span className="flex size-8 items-center justify-center rounded-full border border-primary/40 text-primary">
            <span className="size-2 rounded-full bg-primary" />
          </span>
          <div>
            <strong className="block font-heading text-sm">أركاديا</strong>
            <span className="text-[11px] text-muted-foreground">مركز إدارة الأرشيف</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3 text-sm" aria-label="أقسام الإدارة">
          <AdminNavLink href="#overview" icon={<ActivityIcon />} label="نظرة عامة" />
          <AdminNavLink href="#catalog" icon={<DatabaseIcon />} label="الأعمال والكتالوج" />
          <AdminRouteLink to="/database" icon={<SelectionAllIcon />} label="عارض قاعدة البيانات" />
          <AdminAction
            icon={<BracketsCurlyIcon />}
            label="محرر JSON"
            onClick={() => setJsonEditorOpen(true)}
          />
          <AdminAction
            icon={<BuildingsIcon />}
            label="الأشخاص والمنظمات"
            onClick={() => setEntityManagerOpen(true)}
          />
          <AdminRouteLink
            to="/planets"
            icon={<PlanetIcon />}
            label="الكواكب"
            badge={String(planets.length)}
          />
          <AdminRouteLink to="/lineage" icon={<TreeStructureIcon />} label="السلالة والعلاقات" />
          <AdminRouteLink to="/tracker" icon={<ActivityIcon />} label="المتعقّب" />
          <AdminRouteLink to="/feed" icon={<ActivityIcon />} label="سجل النشاط" />
          <AdminNavLink
            href="#validation"
            icon={<ShieldWarningIcon />}
            label="التحقق"
            badge={String(validationIssues.filter((issue) => issue.severity === "error").length)}
          />
          <AdminAction
            icon={<TranslateIcon />}
            label="قاموس التصنيفات"
            onClick={() => setTaxonomyOpen(true)}
          />
          <AdminAction
            icon={<BookmarkSimpleIcon />}
            label="العروض المحفوظة"
            onClick={() => setViewsManagerOpen(true)}
          />
        </nav>
        <div className="border-t p-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <SignOutIcon /> العودة إلى المنصة
          </Link>
        </div>
      </aside>
      <div className="min-w-0 lg:me-64">
        {/* Top Navigation Bar */}
        <header className="sticky top-2 z-20 mx-auto w-[95vw] max-w-7xl rounded-xl border border-border/60 bg-background/88 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 p-2">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={<Link to="/" />}
                className="rounded-full"
              >
                <span className="sr-only">العودة إلى المكتبة</span>
                <ArrowRightIcon />
              </Button>

              <h1 className="truncate font-heading text-lg font-medium tracking-tight">
                مركز الكتالوج
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEntityManagerOpen(true)}
                className="h-9 gap-1.5 border-border/60 text-xs"
              >
                <BuildingsIcon data-icon="inline-start" />
                الأشخاص والمنظمات
              </Button>

              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link to="/feed" />}
                className="h-9 gap-1.5 border-border/60 text-xs"
              >
                <ActivityIcon data-icon="inline-start" />
                النشاط
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewsManagerOpen(true)}
                className="h-9 gap-1.5 border-border/60 text-xs"
              >
                <BookmarkSimpleIcon data-icon="inline-start" />
                إدارة العروض
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setTaxonomyOpen(true)}
                className="h-9 gap-1.5 border-border/60 text-xs"
              >
                <TranslateIcon data-icon="inline-start" />
                قاموس التصنيفات
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setJsonEditorOpen(true)}
                className="h-9 gap-1.5 border-border/60 text-xs"
              >
                <BracketsCurlyIcon data-icon="inline-start" />
                محرر JSON
              </Button>

              <Button
                size="sm"
                onClick={() => setBulkAddOpen(true)}
                className="h-9 gap-1.5 text-xs shadow-xs"
              >
                <PlusIcon data-icon="inline-start" />
                إضافة أعمال
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div
            id="overview"
            className="mb-4 grid scroll-mt-24 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
          >
            <AdminMetric label="الأعمال" value={works.length} />
            <AdminMetric label="الأشخاص والمنظمات" value={entities.length} />
            <AdminMetric
              label="المساهمات"
              value={works.reduce((total, work) => total + work.contributors.length, 0)}
            />
            <AdminMetric
              label="العلاقات"
              value={new Set(works.flatMap((work) => work.relations.map(({ id }) => id))).size}
            />
            <AdminMetric label="الكواكب" value={planets.length} />
            <AdminMetric label="مشكلات التحقق" value={validationIssues.length} />
          </div>
          <section id="validation" className="mb-5 scroll-mt-24 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <ShieldWarningIcon className="text-primary" /> صحة الكتالوج
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  لا تُصلح أركاديا القيم الملتبسة بصمت؛ تظهرها للمراجعة.
                </p>
              </div>
              <Badge
                variant={
                  validationIssues.some((issue) => issue.severity === "error")
                    ? "destructive"
                    : "secondary"
                }
              >
                {validationIssues.length} ملاحظة
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(["error", "warning", "info"] as const).map((severity) => (
                <div key={severity} className="rounded-lg bg-muted/55 p-3">
                  <span className="text-xs text-muted-foreground">
                    {severity === "error"
                      ? "أخطاء"
                      : severity === "warning"
                        ? "تحذيرات"
                        : "تحسينات"}
                  </span>
                  <strong className="mt-1 block font-mono text-xl">
                    {validationIssues.filter((issue) => issue.severity === severity).length}
                  </strong>
                </div>
              ))}
            </div>
          </section>
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
                  <NotePencilIcon data-icon="inline-start" />
                  <span>تعديل المحدد</span>
                </Button>
              </div>
            </div>
          )}

          {/* Filter and Search Controls Toolbar */}
          <div
            id="catalog"
            className="my-2 flex scroll-mt-24 flex-col items-stretch justify-between gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-2xs sm:flex-row sm:items-center"
          >
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في العناوين والتصنيفات والوسوم والمساهمين…"
                className="text-xs"
                aria-label="البحث في سجلات الإدارة"
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    onClick={() => setSearch("")}
                    aria-label="مسح البحث"
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>

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
                <SelectionAllIcon data-icon="inline-start" />
                <span>{allVisibleSelected ? "إلغاء تحديد الظاهر" : "تحديد الظاهر"}</span>
              </Button>

              <Separator orientation="vertical" className="hidden h-6 bg-border/60 sm:block" />

              <div className="px-1 font-mono text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{visibleWorks.length}</span> /{" "}
                {works.length}
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
                  const isSelected = selectedIds.has(work.id);
                  return (
                    <TableRow
                      key={work.id}
                      className={cn(
                        "border-border/40 transition-colors",
                        isSelected && "bg-primary/5 hover:bg-primary/10",
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
                          variant={work.curation?.status === "verified" ? "default" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {taxonomyLabel("curation-status", work.curation?.status ?? "unreviewed")}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs">
                          <strong className="block font-mono font-medium">
                            {work.episodeCount ?? work.chapterCount ?? work.pageCount ?? "—"}
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
                              <Button variant="ghost" size="icon" className="size-7">
                                <DotsThreeVerticalIcon />
                                <span className="sr-only">فتح القائمة</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => setEditingWork(work)}>
                                <NotePencilIcon />
                                تعديل التفاصيل
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Empty Table State */}
            {!visibleWorks.length && (
              <Empty className="my-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <DatabaseIcon weight="duotone" />
                  </EmptyMedia>
                  <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
                  <EmptyDescription>جرّب مسح عبارة البحث أو تعديل الفلاتر الحالية.</EmptyDescription>
                </EmptyHeader>
                {(search || countFiltersActive(filters)) && (
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setFilters(createDefaultFilters());
                      }}
                    >
                      مسح الفلاتر
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            )}
          </div>
        </main>
      </div>

      {/* Editor & Action Dialog Component Mounts */}
      <WorkEditor
        work={editingWork}
        works={works}
        entities={entities}
        onOpenChange={(open) => !open && setEditingWork(null)}
        onSaved={async () => {
          setEditingWork(null);
          await refresh();
        }}
      />
      <AddWorksDialog open={bulkAddOpen} onOpenChange={setBulkAddOpen} onCreated={refresh} />
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        workIds={[...selectedIds]}
        onUpdated={async () => {
          setSelectedIds(new Set());
          await refresh();
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
      <TaxonomyManagerDialog open={taxonomyOpen} onOpenChange={setTaxonomyOpen} />
      <ViewsManagerDialog open={viewsManagerOpen} onOpenChange={setViewsManagerOpen} />
      <EntityManagerDialog
        open={entityManagerOpen}
        onOpenChange={setEntityManagerOpen}
        entities={entities}
        onSaved={refresh}
      />
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3">
        <CardTitle className="text-xs font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 font-mono text-xl font-semibold tabular-nums">
        {value}
      </CardContent>
    </Card>
  );
}

function AdminNavLink({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <Badge variant="secondary" className="ms-auto">
          {badge}
        </Badge>
      )}
    </a>
  );
}

function AdminRouteLink({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <Badge variant="secondary" className="ms-auto">
          {badge}
        </Badge>
      )}
    </Link>
  );
}

function AdminAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: string }) {
  const formattedStatus = statusLabelsAr[status as keyof typeof statusLabelsAr] ?? status;
  const variant =
    status === "completed"
      ? "default"
      : status === "dropped"
        ? "destructive"
        : status === "in-progress"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{formattedStatus}</Badge>;
}

function countFiltersActive(filters: WorkFilterState): boolean {
  return Boolean(
    filters.kinds.length ||
      filters.excludedKinds.length ||
      filters.statuses.length ||
      filters.excludedStatuses.length ||
      filters.favoriteOnly ||
      filters.minRating > 0,
  );
}
