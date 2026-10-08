import { FileSearchIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DatabaseRow } from "@/features/database/data/database-model";
import { DatabaseRecordTable } from "@/features/database/records/database-record-table";

interface RecordTableProps {
  table?: string;
  filters?: DatabaseRow;
  title: string;
  columns: readonly string[];
  search?: string;
}

export function RecordTable({
  title,
  columns,
  table,
  filters,
  search = "البحث في السجلات",
}: RecordTableProps) {
  if (table)
    return (
      <DatabaseRecordTable
        key={table}
        title={title}
        table={table}
        filters={filters}
        searchPlaceholder={search}
      />
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>ستظهر السجلات الحالية عند اتصال واجهة البيانات.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex max-w-sm">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput placeholder={search} aria-label={search} disabled />
            </InputGroup>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileSearchIcon aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>بانتظار الاتصال بالبيانات</EmptyTitle>
                      <EmptyDescription>
                        لا تُعرض بيانات تجريبية هنا. سجلات المكتبة الحالية لم تتغير.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-muted-foreground">العدد غير متاح بعد</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              السابق
            </Button>
            <Button variant="outline" size="sm" disabled>
              التالي
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
