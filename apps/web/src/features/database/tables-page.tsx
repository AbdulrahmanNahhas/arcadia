import { DatabaseIcon, KeyRoundIcon, LockKeyholeIcon, SaveIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/features/dashboard/page-header";
import { RecordTable } from "@/features/dashboard/record-table";

import schemaCatalog from "./schema-catalog.json";

const tables = [...new Set(schemaCatalog.map((column) => column.table_name))].map((table) => ({
  value: table,
  label: table,
}));
export function TablesPage() {
  const [selected, setSelected] = useState("titles");
  const columns = schemaCatalog.filter((column) => column.table_name === selected);
  const sensitive = selected.startsWith("auth_");
  return (
    <>
      <PageHeader
        title="جميع جداول قاعدة البيانات"
        description="استعراض المخطط الحقيقي، المفاتيح، وأنواع الحقول. إدارة السجلات ستكون مرتبطة بصلاحيات المالك والقيود الفعلية."
        eyebrow="قاعدة البيانات / الأدوات المتقدمة"
        actions={<Badge variant="outline">{tables.length} جدولاً</Badge>}
      />
      <Card>
        <CardHeader>
          <CardTitle>اختيار الجدول</CardTitle>
          <CardDescription>
            مخطط محفوظ من قاعدة البيانات الحالية؛ لا يتضمن أي قيم خاصة أو جلسات.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="table-selector">الجدول</FieldLabel>
              <Select
                items={tables}
                value={selected}
                onValueChange={(value) => {
                  if (value) setSelected(value);
                }}
              >
                <SelectTrigger id="table-selector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {tables.map((table) => (
                      <SelectItem key={table.value} value={table.value}>
                        {table.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <DatabaseIcon />
            {columns.length} حقلاً في هذا الجدول
          </span>
        </CardFooter>
      </Card>
      <Tabs defaultValue="schema">
        <TabsList>
          <TabsTrigger value="schema">الحقول والقيود</TabsTrigger>
          <TabsTrigger value="records">السجلات</TabsTrigger>
        </TabsList>
        <TabsContent value="schema">
          <Card>
            <CardHeader>
              <CardTitle>{selected}</CardTitle>
              <CardDescription>النوع، القيم الفارغة، والمفتاح الأساسي لكل حقل.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الحقل</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>القيم الفارغة</TableHead>
                    <TableHead>القيود</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((column) => (
                    <TableRow key={column.column_name}>
                      <TableCell>
                        <code dir="ltr">{column.column_name}</code>
                      </TableCell>
                      <TableCell>
                        <code dir="ltr">{column.data_type}</code>
                      </TableCell>
                      <TableCell>
                        {column.is_nullable === "YES" ? "مسموحة" : "غير مسموحة"}
                      </TableCell>
                      <TableCell>
                        {column.primary_key ? (
                          <Badge variant="secondary">
                            <KeyRoundIcon data-icon="inline-start" />
                            أساسي
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <Button disabled>
                <SaveIcon data-icon="inline-start" />
                تعديل السجلات
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="records">
          {sensitive && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LockKeyholeIcon />
              الحقول السرية تُحجب، وتغييرات الحسابات تمر عبر أدوات الهوية والصلاحيات.
            </p>
          )}
          <RecordTable
            title={`سجلات ${selected}`}
            columns={columns.slice(0, 6).map((column) => column.column_name)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
