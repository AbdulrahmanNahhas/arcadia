import {
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  SelectionPlusIcon,
} from "@phosphor-icons/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { WorkEditor } from "@/features/admin/components/editor-form";
import { JsonEditorDialog } from "@/features/admin/components/json-editor";
import type { Work } from "@/features/library/model";
import { getEntities, getWorks } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const kindOptions = [
  { value: "all", label: "كل الأنواع" },
  { value: "movie", label: "فيلم" },
  { value: "series", label: "مسلسل" },
  { value: "anime", label: "أنمي" },
  { value: "game", label: "لعبة" },
  { value: "novel", label: "رواية" },
  { value: "manga", label: "مانغا" },
  { value: "visual-novel", label: "رواية مرئية" },
  { value: "comic", label: "قصص مصوّرة" },
] as const;

export function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return works.filter(
      (work) =>
        (kind === "all" || work.kind === kind) &&
        (!query ||
          [work.title, work.arabicTitle ?? "", ...work.aliases]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    );
  }, [kind, search, works]);
  const visibleIds = visible.map(({ id }) => id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["works"] });
  };
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
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <Badge>{selectedIds.size} محدد</Badge>
                <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)}>
                  <SelectionPlusIcon data-icon="inline-start" /> تعديل سريع
                </Button>
                <Button size="sm" onClick={() => setJsonEditorOpen(true)}>
                  <NotePencilIcon data-icon="inline-start" /> محرر JSON
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  مسح التحديد
                </Button>
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <Field>
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
            <Field>
              <FieldLabel className="sr-only" htmlFor="catalog-kind">
                نوع العمل
              </FieldLabel>
              <Select
                items={kindOptions}
                value={kind}
                onValueChange={(value) => setKind(value ?? "all")}
              >
                <SelectTrigger id="catalog-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {kindOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
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
                <EmptyDescription>غيّر البحث أو مرشح النوع.</EmptyDescription>
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
        <Badge variant="outline">
          {kindOptions.find((item) => item.value === work.kind)?.label ?? work.kind}
        </Badge>
      </TableCell>
      <TableCell className="font-mono">{work.year ?? "—"}</TableCell>
      <TableCell>{work.status}</TableCell>
      <TableCell className="font-mono">{work.calculatedRating?.toFixed(1) ?? "—"}</TableCell>
      <TableCell>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`تعديل ${work.title}`}>
          <NotePencilIcon />
        </Button>
      </TableCell>
    </TableRow>
  );
}
