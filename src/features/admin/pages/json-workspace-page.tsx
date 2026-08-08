import { BracketsCurlyIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JsonEditorDialog } from "@/features/admin/components/json-editor";
import { getWorks } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

export function JsonWorkspacePage() {
  const queryClient = useQueryClient();
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const visibleWorks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return works.filter(
      (work) =>
        !query ||
        [work.title, work.arabicTitle ?? "", ...work.aliases]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
    );
  }, [search, works]);
  const visibleIds = visibleWorks.map(({ id }) => id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
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
    <div className="flex min-w-0 flex-col gap-8">
      <AdminPageHeader
        title="محرر JSON"
        description="حدّد مجموعة سجلات أولاً، ثم اعرض فقط الحقول التي تريدها وراجع كل فرق قبل الحفظ."
      />
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>اختيار السجلات</CardTitle>
              <CardDescription>يبقى التحديد محفوظاً أثناء البحث.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size ? <Badge>{selectedIds.size} محدد</Badge> : null}
              <Button disabled={!selectedIds.size} onClick={() => setOpen(true)}>
                <BracketsCurlyIcon data-icon="inline-start" /> تحرير المحدد
              </Button>
            </div>
          </div>
          <Field>
            <FieldLabel className="sr-only" htmlFor="json-workspace-search">
              بحث الأعمال
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="json-workspace-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في العناوين والأسماء البديلة…"
              />
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </CardHeader>
        <CardContent className="px-0">
          {visibleWorks.length ? (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleWorks.map((work) => (
                    <TableRow
                      key={work.id}
                      data-state={selectedIds.has(work.id) ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(work.id)}
                          onCheckedChange={(checked) => toggleWork(work.id, checked === true)}
                          aria-label={`تحديد ${work.arabicTitle || work.title}`}
                        />
                      </TableCell>
                      <TableCell>
                        <strong className="font-medium">{work.arabicTitle || work.title}</strong>
                        {work.arabicTitle ? (
                          <span className="ms-2 text-xs text-muted-foreground">{work.title}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{work.kind}</TableCell>
                      <TableCell className="font-mono">{work.year ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
                <EmptyDescription>غيّر عبارة البحث.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      {open ? (
        <JsonEditorDialog
          open={open}
          onOpenChange={setOpen}
          works={works}
          visibleWorks={visibleWorks}
          selectedIds={selectedIds}
          initialScope="selected"
          onSaved={async () => {
            setSelectedIds(new Set());
            await queryClient.invalidateQueries({ queryKey: ["works"] });
          }}
        />
      ) : null}
    </div>
  );
}
