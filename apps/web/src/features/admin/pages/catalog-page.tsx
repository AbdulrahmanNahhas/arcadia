import {
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  SelectionPlusIcon,
  SidebarSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { BulkEditDialog } from "@/features/admin/components/bulk-edit";
import {
  buildCatalogFacetOptions,
  createCatalogFilters,
  workMatchesCatalogFilters,
} from "@/features/catalog/catalog-filtering";
import { CatalogFilterSheet, CatalogFilterSidebar } from "@/features/catalog/catalog-filters";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";
import { deleteWorks, getAdminWorks } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const kindLabels = {
  movie: "فيلم",
  series: "مسلسل",
  anime: "أنمي",
  game: "لعبة",
  novel: "رواية",
  manga: "مانغا",
  "visual-novel": "رواية مرئية",
  comic: "قصص مصوّرة",
} as const;

export function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const { data: works } = useSuspenseQuery({
    queryKey: ["admin-works"],
    queryFn: () => getAdminWorks(),
  });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(createCatalogFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const facetOptions = useMemo(() => buildCatalogFacetOptions(works), [works]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return works.filter(
      (work) =>
        workMatchesCatalogFilters(work, filters) &&
        (!query ||
          [work.title, work.arabicTitle ?? "", ...work.aliases]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    );
  }, [filters, search, works]);
  const visibleIds = visible.map(({ id }) => id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-works"] });
  };
  const deleteMutation = useMutation({
    mutationFn: deleteWorks,
    onSuccess: async () => {
      const deleted = new Set(deletingIds);
      setSelectedIds((current) => new Set([...current].filter((id) => !deleted.has(id))));
      setDeletingIds([]);
      await refresh();
    },
  });
  const toggleVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  const toggleWork = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const filterProps = {
    filters,
    onChange: setFilters,
    options: facetOptions,
    matchingCount: visible.length,
    onClear: () => setFilters(createCatalogFilters()),
    allowPrivacy: true,
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminPageHeader
        title="الأعمال والكتالوج"
        description="حدّد أعمالاً عبر البحث والفلاتر، ثم طبّق تعديلات سريعة أو راجع تغييرات JSON الدقيقة بأمان."
        actions={
          <Button nativeButton={false} render={<Link to="/admin/catalog/new" />}>
            <PlusIcon data-icon="inline-start" /> إضافة عمل
          </Button>
        }
      />
      <Card className="mx-5 mb-6 min-w-0 px-0 pb-0 sm:mx-6">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>السجلات</CardTitle>
              <CardDescription>
                {visible.length} من أصل {works.length} عمل
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <div className="fixed bottom-6 inset-x-0 z-50 mx-auto max-w-xl px-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-2.5 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80 dir-rtl">
                  {/* جهة اليمين: العداد ومسح التحديد */}
                  <div className="flex items-center gap-2 pr-1">
                    <Badge variant="secondary" className="h-7 px-2.5 text-xs font-semibold">
                      {selectedIds.size} محدد
                    </Badge>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      <XIcon className="me-1.5 h-3.5 w-3.5" />
                      إلغاء التحديد
                    </Button>
                  </div>

                  {/* جهة اليسار: أزرار الإجراءات */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setBulkEditOpen(true)}
                    >
                      <SelectionPlusIcon className="h-3.5 w-3.5" />
                      تعديل سريع
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      nativeButton={false}
                      render={
                        <Link
                          to="/admin/catalog/json"
                          search={{ ids: [...selectedIds], scope: "ids" }}
                        />
                      }
                    >
                      <NotePencilIcon className="h-3.5 w-3.5" />
                      محرر JSON
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setDeletingIds([...selectedIds])}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Field className="min-w-0 flex-1">
              <FieldLabel className="sr-only" htmlFor="catalog-search">
                بحث الأعمال
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="catalog-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث في العناوين والأسماء البديلة…"
                />
                <InputGroupAddon>
                  <MagnifyingGlassIcon />
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <CatalogFilterSheet {...filterProps} />
            <Button
              variant={showFilters ? "secondary" : "outline"}
              className="hidden lg:inline-flex"
              aria-pressed={showFilters}
              onClick={() => setShowFilters((current) => !current)}
            >
              <SidebarSimpleIcon data-icon="inline-start" />
              {showFilters ? "إخفاء المرشحات" : "إظهار المرشحات"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div
            className={cn(
              "grid items-start gap-6 px-6 pb-6",
              showFilters && "lg:grid-cols-[19rem_minmax(0,1fr)]",
            )}
          >
            {showFilters ? <CatalogFilterSidebar {...filterProps} /> : null}
            {visible.length ? (
              <div className="min-w-0">
                <div className="mb-5 flex w-fit items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    aria-label="تحديد كل النتائج الحالية"
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleVisible(checked === true)}
                  />
                  تحديد كل النتائج الحالية
                </div>
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
              </div>
            ) : (
              <Empty className="min-h-80 border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
                  <EmptyDescription>غيّر البحث أو الفلاتر.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </CardContent>
      </Card>
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
            سيُحذف العمل وكل سجلاته المرتبطة من قاعدة البيانات. ستُحذف ملفات الصور المحلية فقط إذا لم
            تعد مستخدمة في أي سجل آخر.
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
          aria-label={`تحديد ${work.arabicTitle || work.title}`}
        />
      </div>
      <Link
        to="/admin/catalog/$workId"
        params={{ workId: work.id }}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-muted ring-1 ring-white/10 transition duration-500 group-hover:-translate-y-1 group-hover:ring-primary/40">
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              className="size-full object-cover transition duration-700 group-hover:scale-105"
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black via-black/70 to-transparent p-3 pt-12 text-white">
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{kindLabels[work.kind] ?? work.kind}</Badge>
              {work.isPrivate ? <Badge variant="destructive">خاص</Badge> : null}
            </div>
          </div>
        </div>
        <div className="px-0.5 pt-3">
          <h3 className="truncate text-sm font-semibold">{work.arabicTitle || work.title}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {work.year ?? "—"} · {work.calculatedRating?.toFixed(1) ?? "بلا تقييم"}
          </p>
        </div>
      </Link>
    </article>
  );
}
