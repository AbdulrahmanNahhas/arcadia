import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { DatabaseRow } from "./database-model";
import { restoreDatabaseRecord } from "./database.functions";
import { databaseRecordsOptions, databaseKeys } from "./database.queries";
import { RecordEditor } from "./record-editor";

const emptyFilters: DatabaseRow = {};
function display(value: DatabaseRow[string] | undefined) {
  if (value === null || value === undefined) return "—";
  const text = z.string().safeParse(value);
  return text.success ? text.data : JSON.stringify(value);
}
function recordId(row: DatabaseRow) {
  return z.string().safeParse(row.id).data;
}
export function DatabaseRecordTable({
  title,
  table,
  filters = emptyFilters,
  searchPlaceholder,
}: {
  title: string;
  table: string;
  filters?: DatabaseRow;
  searchPlaceholder: string;
}) {
  const filtersInUrl = useSearch({ from: "__root__" });
  const offset = filtersInUrl.offset ?? 0;
  const search = filtersInUrl.q ?? "";
  const navigate = useNavigate();
  function setOffset(value: number) {
    void navigate({ to: ".", search: (previous) => ({ ...previous, offset: value }) });
  }
  const [editor, setEditor] = useState<{ row: DatabaseRow | null } | null>(null);
  const query = useQuery(databaseRecordsOptions(table, offset, search, filters));
  const client = useQueryClient();
  const restore = useMutation({
    mutationFn: (id: string) => restoreDatabaseRecord({ data: { audit_id: id } }),
    onSuccess: () => client.invalidateQueries({ queryKey: databaseKeys.all }),
  });
  const meta = query.data?.table;
  const columns =
    meta?.columns
      .filter(
        (column) =>
          !column.name.includes("password") &&
          !column.name.includes("token") &&
          !column.name.includes("secret"),
      )
      .slice(0, 7) ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          سجلات قاعدة البيانات الحالية · {query.data?.total ?? "…"} سجل
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void navigate({
                to: ".",
                search: (previous) => ({
                  ...previous,
                  q: String(data.get("search") ?? ""),
                  offset: 0,
                }),
              });
            }}
          >
            <div className="min-w-0 flex-1">
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  name="search"
                  key={search}
                  defaultValue={search}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
              </InputGroup>
            </div>
            <Button type="submit" variant="outline">
              بحث
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="تحديث السجلات"
              onClick={() => void query.refetch()}
            >
              <RefreshCwIcon data-icon="inline-start" />
            </Button>
            <Button
              type="button"
              disabled={!meta?.writable}
              onClick={() => setEditor({ row: null })}
            >
              <PlusIcon data-icon="inline-start" />
              إضافة سجل
            </Button>
          </form>
          {query.isPending ? (
            <Skeleton className="h-80" />
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertTitle>تعذّر تحميل السجلات</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.name}>
                      <code dir="ltr">{column.name}</code>
                    </TableHead>
                  ))}
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.rows.map((row) => (
                  <TableRow
                    key={JSON.stringify(
                      meta?.columns
                        .filter((column) => column.primary)
                        .map((column) => row[column.name]),
                    )}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.name}>
                        <span className="block max-w-64 truncate" title={display(row[column.name])}>
                          {display(row[column.name])}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {table === "titles" && (
                          <Link
                            to="/database/json"
                            search={{ work: recordId(row) }}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            JSON
                          </Link>
                        )}
                        {meta?.writable ? (
                          <Button variant="ghost" size="sm" onClick={() => setEditor({ row })}>
                            <PencilIcon data-icon="inline-start" />
                            تحرير
                          </Button>
                        ) : table === "audit_logs" &&
                          row.action === "local.delete" &&
                          recordId(row) !== undefined ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restore.isPending}
                            onClick={() => {
                              if (recordId(row) !== undefined)
                                restore.mutate(String(recordId(row)));
                            }}
                          >
                            استعادة
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setEditor({ row })}>
                            عرض السجل
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {query.data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1}>
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>لا توجد سجلات مطابقة</EmptyTitle>
                          <EmptyDescription>غيّر البحث أو أضف سجلاً جديداً.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {restore.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّرت الاستعادة</AlertTitle>
              <AlertDescription>{restore.error.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {query.data
              ? `${offset + 1}–${offset + query.data.rows.length} / ${query.data.total}`
              : "…"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={offset === 0 || query.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              disabled={!query.data || offset + 50 >= query.data.total || query.isFetching}
              onClick={() => setOffset(offset + 50)}
            >
              التالي
            </Button>
          </div>
        </div>
      </CardFooter>
      {editor && meta && (
        <RecordEditor table={meta} row={editor.row} onClose={() => setEditor(null)} />
      )}
    </Card>
  );
}
