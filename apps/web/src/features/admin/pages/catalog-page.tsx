import {
  ArrowSquareOutIcon,
  ListNumbersIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PencilSimpleIcon,
  PlusIcon,
  SelectionPlusIcon,
  SquaresFourIcon,
  TableIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkEditDialog } from "@/features/admin/components/bulk-edit";
import { taxonomyLabels, type Work } from "@/features/library/model";
import { kindLabelsAr as kindLabels } from "@/features/library/translations";
import { getPlanets } from "@/lib/api";
import { cn } from "@/lib/utils";
import { deleteWorks, getAdminWorks } from "@/server/library.functions";
import { type CatalogGap, catalogGapLabels, catalogGaps } from "../catalog-gaps";
import {
  type CatalogView,
  catalogSortLabels,
  catalogSorts,
  catalogWorkflows,
  countActiveFilters,
  filterWorks,
  titleOf,
  workGaps,
} from "../catalog-view";
import { AdminPageHeader } from "../components/admin-page-header";

/**
 * `/admin/catalog` — one toolbar, one list. Every filter/sort/view lives in the URL (and is
 * remembered), the table shows what an editor needs to decide (poster, name, kind, planet,
 * status, rating, what is missing) with the actions on the row, and selection unlocks the bulk
 * tools. The public browse page keeps its 21-facet drawer; this page is for working the catalog,
 * not exploring it.
 */
export function AdminCatalogPage({
  view,
  onViewChange,
}: {
  view: CatalogView;
  onViewChange: (next: CatalogView) => void;
}) {
  const queryClient = useQueryClient();
  const { data: works } = useSuspenseQuery({
    queryKey: ["admin-works"],
    queryFn: () => getAdminWorks(),
  });
  const planets = useQuery({ queryKey: ["planets"], queryFn: getPlanets, staleTime: 5 * 60_000 });
  const planetName = useMemo(
    () => new Map((planets.data ?? []).map((planet) => [planet.id, planet.nameAr])),
    [planets.data],
  );
  // Base UI's Select.Value shows the raw value until the popup has mounted its items; `items`
  // hands it the labels up front.
  const planetItems = useMemo(
    () =>
      Object.fromEntries([
        ["all", "كل الكواكب"],
        ...(planets.data ?? []).map((planet) => [planet.id, `${planet.icon} ${planet.nameAr}`]),
      ]),
    [planets.data],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => filterWorks(works, view), [works, view]);
  const visibleIds = visible.map(({ id }) => id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const set = (patch: Partial<CatalogView>) => onViewChange({ ...view, ...patch });
  const activeFilters = countActiveFilters(view);

  // "/" focuses the search from anywhere on the page, like the browse page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, textarea, [contenteditable]"))
        return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-works"] });
  const deleteMutation = useMutation({
    mutationFn: deleteWorks,
    onSuccess: async (_result, variables) => {
      const deleted = new Set(variables.data.ids);
      setSelectedIds((current) => new Set([...current].filter((id) => !deleted.has(id))));
      setDeletingIds([]);
      await refresh();
    },
  });
  const toggleVisible = (checked: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const toggleWork = (id: string, checked: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-24">
      <AdminPageHeader
        title="الأعمال"
        description={`${works.length} عمل في الأرشيف${visible.length !== works.length ? ` · ${visible.length} ظاهر` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              <Button
                size="icon-sm"
                variant={(view.view ?? "table") === "table" ? "secondary" : "ghost"}
                aria-label="جدول"
                aria-pressed={(view.view ?? "table") === "table"}
                onClick={() => set({ view: "table" })}
              >
                <TableIcon />
              </Button>
              <Button
                size="icon-sm"
                variant={view.view === "grid" ? "secondary" : "ghost"}
                aria-label="ملصقات"
                aria-pressed={view.view === "grid"}
                onClick={() => set({ view: "grid" })}
              >
                <SquaresFourIcon />
              </Button>
            </div>
            <Button nativeButton={false} render={<Link to="/admin/catalog/new" />}>
              <PlusIcon data-icon="inline-start" /> إضافة عمل
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 px-5 sm:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <InputGroup className="min-w-0 flex-1">
            <InputGroupInput
              ref={searchRef}
              value={view.q ?? ""}
              onChange={(event) => set({ q: event.target.value || undefined })}
              placeholder="ابحث بالاسم العربي أو الإنجليزي أو الأسماء البديلة… (/)"
              aria-label="بحث الأعمال"
            />
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-wrap items-center gap-2">
            <Chips
              value={view.structure}
              options={[
                ["movie", "أفلام"],
                ["series", "مسلسلات"],
              ]}
              onChange={(structure) => set({ structure })}
            />
            <Chips
              value={view.format}
              options={[
                ["animated", "رسوم"],
                ["live-action", "حيّ"],
              ]}
              onChange={(format) => set({ format })}
            />
            <Chips
              value={view.visibility}
              options={[
                ["public", "عام"],
                ["private", "خاص"],
              ]}
              onChange={(visibility) => set({ visibility })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={view.workflow ?? "all"}
            items={{ all: "كل حالات النشر", ...workflowStatuses }}
            onValueChange={(value) => set({ workflow: pick(value, workflowStatusKeys) })}
          >
            <SelectTrigger className="h-8 w-40" aria-label="حالة النشر">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">كل حالات النشر</SelectItem>
                {workflowStatusKeys.map((status) => (
                  <SelectItem key={status} value={status}>
                    {workflowStatuses[status]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={view.planet ?? "all"}
            items={planetItems}
            onValueChange={(value) => set({ planet: value && value !== "all" ? value : undefined })}
          >
            <SelectTrigger className="h-8 w-44" aria-label="الكوكب">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">كل الكواكب</SelectItem>
                {(planets.data ?? []).map((planet) => (
                  <SelectItem key={planet.id} value={planet.id}>
                    {planet.icon} {planet.nameAr}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={view.gap ?? "all"}
            items={{ all: "كل الأعمال", ...catalogGapLabels }}
            onValueChange={(value) => set({ gap: pick(value, catalogGaps) })}
          >
            <SelectTrigger className="h-8 w-44" aria-label="النواقص">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">كل الأعمال</SelectItem>
                {catalogGaps.map((gap) => (
                  <SelectItem key={gap} value={gap}>
                    {catalogGapLabels[gap]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={view.sort ?? "title"}
            items={catalogSortLabels}
            onValueChange={(value) => set({ sort: pick(value, catalogSorts) })}
          >
            <SelectTrigger className="h-8 w-40" aria-label="الترتيب">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {catalogSorts.map((sort) => (
                  <SelectItem key={sort} value={sort}>
                    {catalogSortLabels[sort]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={() => onViewChange({ view: view.view, sort: view.sort })}
            >
              <XIcon data-icon="inline-start" /> مسح التصفية ({activeFilters})
            </Button>
          )}
          <span className="ms-auto text-xs text-muted-foreground">{visible.length} نتيجة</span>
        </div>
      </div>

      <div className="px-5 sm:px-6">
        {visible.length === 0 ? (
          <Empty className="min-h-80 border border-dashed">
            <EmptyHeader>
              <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
              <EmptyDescription>غيّر البحث أو امسح التصفية.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : view.view === "grid" ? (
          <div className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
            {visible.map((work) => (
              <CatalogCard
                key={work.id}
                work={work}
                checked={selectedIds.has(work.id)}
                onCheckedChange={(checked) => toggleWork(work.id, checked)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="تحديد كل النتائج"
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleVisible(checked === true)}
                    />
                  </TableHead>
                  <TableHead>العمل</TableHead>
                  <TableHead className="w-32">النوع</TableHead>
                  <TableHead className="w-32">الكوكب</TableHead>
                  <TableHead className="w-36">الحالة</TableHead>
                  <TableHead className="w-20">التقييم</TableHead>
                  <TableHead>النواقص</TableHead>
                  <TableHead className="w-36 text-end">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((work) => (
                  <CatalogRow
                    key={work.id}
                    work={work}
                    planet={work.planetId ? (planetName.get(work.planetId) ?? "—") : "—"}
                    checked={selectedIds.has(work.id)}
                    onCheckedChange={(checked) => toggleWork(work.id, checked)}
                    onGap={(gap) => set({ gap })}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-50 mx-auto max-w-2xl px-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-2.5 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-7 px-2.5 text-xs font-semibold">
                {selectedIds.size} محدد
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setSelectedIds(new Set())}
              >
                <XIcon data-icon="inline-start" /> إلغاء
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setBulkEditOpen(true)}
              >
                <SelectionPlusIcon data-icon="inline-start" /> تعديل سريع
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                nativeButton={false}
                render={
                  <Link to="/admin/catalog/json" search={{ ids: [...selectedIds], scope: "ids" }} />
                }
              >
                <NotePencilIcon data-icon="inline-start" /> محرر JSON
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs"
                onClick={() => setDeletingIds([...selectedIds])}
              >
                <TrashIcon data-icon="inline-start" /> حذف
              </Button>
            </div>
          </div>
        </div>
      )}

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        workIds={[...selectedIds]}
        onUpdated={async () => {
          setSelectedIds(new Set());
          await refresh();
        }}
      />
      <DeleteWorksDialog
        ids={deletingIds}
        open={deletingIds.length > 0}
        onOpenChange={(open) => !open && setDeletingIds([])}
        onConfirm={() => deleteMutation.mutate({ data: { ids: deletingIds } })}
        pending={deleteMutation.isPending}
        error={deleteMutation.error?.message}
      />
    </div>
  );
}

const workflowStatuses = taxonomyLabels.workflowStatuses;
const workflowStatusKeys = catalogWorkflows;

/** A `<Select>` value back into one of the allowed literals, or `undefined` for "all". */
function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((entry) => entry === value);
}

function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (next: T | undefined) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border p-0.5">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(value === option ? undefined : option)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            value === option
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CatalogRow({
  work,
  planet,
  checked,
  onCheckedChange,
  onGap,
}: {
  work: Work;
  planet: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onGap: (gap: CatalogGap) => void;
}) {
  const gaps = workGaps(work);
  const series = work.kind.endsWith("-series");
  return (
    <TableRow data-state={checked ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={`تحديد ${titleOf(work)}`}
        />
      </TableCell>
      <TableCell>
        <Link
          to="/admin/catalog/$workId"
          params={{ workId: work.id }}
          className="flex items-center gap-3 hover:text-primary"
        >
          <span className="block h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10">
            {work.imagePath && (
              <img
                src={work.imagePath}
                alt=""
                width={40}
                height={56}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{titleOf(work)}</span>
            <span className="block truncate text-xs text-muted-foreground" dir="ltr">
              {work.arabicTitle?.trim() ? work.title : ""}
              {work.year ? ` · ${work.year}` : ""}
            </span>
          </span>
        </Link>
      </TableCell>
      <TableCell className="text-xs">{kindLabels[work.kind] ?? work.kind}</TableCell>
      <TableCell className="text-xs">{planet}</TableCell>
      <TableCell>
        <span className="flex flex-wrap gap-1">
          <Badge variant={work.workflowStatus === "published" ? "secondary" : "outline"}>
            {work.workflowStatus ? workflowStatuses[work.workflowStatus] : "—"}
          </Badge>
          {work.isPrivate && <Badge variant="destructive">خاص</Badge>}
        </span>
      </TableCell>
      <TableCell className="font-mono text-xs tabular-nums">
        {work.calculatedRating?.toFixed(1) ?? "—"}
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap gap-1">
          {gaps.length === 0 ? (
            <span className="text-xs text-muted-foreground">مكتمل</span>
          ) : (
            gaps.map((gap) => (
              <button
                key={gap}
                type="button"
                onClick={() => onGap(gap)}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                title={`اعرض كل الأعمال ${catalogGapLabels[gap]}`}
              >
                {catalogGapLabels[gap]}
              </button>
            ))
          )}
        </span>
      </TableCell>
      <TableCell className="text-end">
        <span className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="تحرير"
            title="تحرير"
            nativeButton={false}
            render={<Link to="/admin/catalog/$workId" params={{ workId: work.id }} />}
          >
            <PencilSimpleIcon />
          </Button>
          {series && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="الحلقات"
              title="الحلقات"
              nativeButton={false}
              render={
                <Link
                  to="/admin/catalog/$workId/episodes"
                  params={{ workId: work.id }}
                  search={{}}
                />
              }
            >
              <ListNumbersIcon />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="عرض في المنصة"
            title="عرض في المنصة"
            nativeButton={false}
            render={<Link to="/titles/$titleId" params={{ titleId: work.id }} />}
          >
            <ArrowSquareOutIcon />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  );
}

function CatalogCard({
  work,
  checked,
  onCheckedChange,
}: {
  work: Work;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <article className="group relative min-w-0">
      <div className="absolute top-2 inset-s-2 z-20 rounded-md bg-background/80 p-1 backdrop-blur">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={`تحديد ${titleOf(work)}`}
        />
      </div>
      <Link
        to="/admin/catalog/$workId"
        params={{ workId: work.id }}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10 group-hover:ring-primary/40">
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition"
            />
          ) : null}
          <div data-on-artwork className="absolute left-2 top-2 text-white">
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{kindLabels[work.kind] ?? work.kind}</Badge>
              {work.isPrivate ? (
                <Badge
                  variant="destructive"
                  data-on-artwork
                  className="bg-destructive/75! text-white! backdrop-blur-lg"
                >
                  خاص
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="px-0.5 pt-3">
          <h3 className="truncate text-sm font-semibold">{titleOf(work)}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {work.year ?? "—"} · {work.calculatedRating?.toFixed(1) ?? "بلا تقييم"}
          </p>
        </div>
      </Link>
    </article>
  );
}

function DeleteWorksDialog({
  ids,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>حذف {ids.length} عمل</DialogTitle>
          <DialogDescription>
            سيُحذف العمل وكل سجلاته المرتبطة من قاعدة البيانات، بما فيها سجلات المشاهدة. ستُحذف ملفات
            الصور المحلية فقط إذا لم تعد مستخدمة في أي سجل آخر.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending || ids.length === 0}>
            <TrashIcon data-icon="inline-start" />
            {pending ? "جارٍ الحذف…" : "حذف نهائياً"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
