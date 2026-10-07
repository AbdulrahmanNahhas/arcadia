import { useQuery } from "@tanstack/react-query";
import { useSearch, useNavigate } from "@tanstack/react-router";
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

import { databaseSchemaOptions } from "./database.queries";
import schemaCatalog from "./schema-catalog.json";

const tables = [...new Set(schemaCatalog.map((column) => column.table_name))].map((table) => ({
  value: table,
  label: table,
}));
export function TablesPage() {
  const liveSchema = useQuery(databaseSchemaOptions());
  const [activeTab, setActiveTab] = useState("schema");
  const search = useSearch({ from: "__root__" });
  const selected = search.table ?? "titles";
  const navigate = useNavigate();
  function setSelected(value: string) {
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, table: value, q: undefined, offset: 0 }),
    });
  }
  const actual = liveSchema.data?.find((table) => table.name === selected);
  const columns = actual
    ? actual.columns.map((column) => ({
        column_name: column.name,
        data_type: column.data_type,
        is_nullable: column.nullable ? "YES" : "NO",
        primary_key: column.primary,
      }))
    : schemaCatalog.filter((column) => column.table_name === selected);
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
            مخطط قاعدة البيانات المتصلة، مع استعراض السجلات والتحرير وفق قيودها.
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              <Button onClick={() => setActiveTab("records")}>
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
            table={selected}
            title={`سجلات ${selected}`}
            columns={columns.slice(0, 6).map((column) => column.column_name)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
