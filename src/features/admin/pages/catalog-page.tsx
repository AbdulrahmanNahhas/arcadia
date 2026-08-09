import {
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  SelectionPlusIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkEditDialog } from "@/features/admin/components/bulk-edit";
import { WorkEditor } from "@/features/admin/components/editor-form";
import { JsonEditorDialog } from "@/features/admin/components/json-editor";
import { AdvancedFilter } from "@/features/library/filter-sheet";
import {
  buildFacetOptions,
  createDefaultFilters,
  workMatchesFilters,
} from "@/features/library/filtering";
import type { Work } from "@/features/library/model";
import { deleteWorks, getEntities, getWorks } from "@/server/library.functions";
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
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(createDefaultFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const facetOptions = useMemo(() => buildFacetOptions(works), [works]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return works.filter(
      (work) =>
        workMatchesFilters(work, filters) &&
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
    await queryClient.invalidateQueries({ queryKey: ["works"] });
  };
  const deleteMutation = useMutation({
    mutationFn: deleteWorks,
    onSuccess: async () => {
      const deleted = new Set(deletingIds);
      setEditingWork((current) => (current && deleted.has(current.id) ? null : current));
      setSelectedIds((current) => new Set([...current].filter((id) => !deleted.has(id))));
      setDeletingIds([]);
      await refresh();
    },
  });
  const toggleVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  };
  const toggleWork = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
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
      <Card className="m-6 mr-5 mt-0 px-0 pb-0">
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
                      onClick={() => setJsonEditorOpen(true)}
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
            <AdvancedFilter
              filters={filters}
              facetOptions={facetOptions}
              onChange={setFilters}
              matchingCount={visible.length}
              title="فلترة سجلات الكتالوج"
              triggerLabel="الفلاتر"
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {visible.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(checked) => toggleVisible(checked === true)}
                        aria-label="تحديد كل النتائج الحالية"
                      />
                    </TableHead>
                    <TableHead>العمل</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>السنة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التقييم</TableHead>
                    <TableHead>
                      <span className="sr-only">إجراء</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((work) => (
                    <CatalogRow
                      key={work.id}
                      work={work}
                      checked={selectedIds.has(work.id)}
                      onCheckedChange={(checked) => toggleWork(work.id, checked)}
                      onEdit={() => setEditingWork(work)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
                <EmptyDescription>غيّر البحث أو الفلاتر.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
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
      {jsonEditorOpen ? (
        <JsonEditorDialog
          open={jsonEditorOpen}
          onOpenChange={setJsonEditorOpen}
          works={works}
          visibleWorks={visible}
          selectedIds={selectedIds}
          onSaved={async () => {
            setSelectedIds(new Set());
            await refresh();
          }}
          initialScope="selected"
        />
      ) : null}
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

function CatalogRow({
  work,
  checked,
  onCheckedChange,
  onEdit,
}: {
  work: Work;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <TableRow data-state={checked ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={`تحديد ${work.arabicTitle || work.title}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="size-10 overflow-hidden rounded-md bg-muted">
            {work.imagePath && (
              <img src={work.imagePath} alt="" className="size-full object-cover" />
            )}
          </span>
          <div className="min-w-0">
            <strong className="block max-w-72 truncate text-sm font-medium">
              {work.arabicTitle || work.title}
            </strong>
            <span className="block max-w-72 truncate text-xs text-muted-foreground">
              {work.title}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{kindLabels[work.kind] ?? work.kind}</Badge>
      </TableCell>
      <TableCell className="font-mono">{work.year ?? "—"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{work.status}</span>
          {work.isPrivate ? <Badge variant="secondary">خاص</Badge> : null}
        </div>
      </TableCell>
      <TableCell className="font-mono">{work.calculatedRating?.toFixed(1) ?? "—"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`تعديل ${work.title}`}>
            <NotePencilIcon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
