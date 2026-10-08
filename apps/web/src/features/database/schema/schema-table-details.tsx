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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { schemaEdges, type SchemaTable } from "@/features/database/schema/schema-graph-model";

export function SchemaTableDetails({
  table,
  onSelect,
}: {
  table: SchemaTable;
  onSelect: (name: string) => void;
}) {
  const relationships = schemaEdges.filter(
    (edge) => edge.source === table.name || edge.target === table.name,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <code dir="ltr">{table.name}</code>
        </CardTitle>
        <CardDescription>
          تعريف الحقول، العلاقات الواردة والصادرة، الفهارس، وقيود الجدول.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحقل</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>القيود</TableHead>
                <TableHead>القيمة الافتراضية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.columns.map((column) => (
                <TableRow key={column.name}>
                  <TableCell>
                    <code dir="ltr">{column.name}</code>
                  </TableCell>
                  <TableCell>
                    <code dir="ltr">{column.type}</code>
                    {column.enumValues.length > 0 && (
                      <p dir="ltr" className="max-w-sm text-xs text-muted-foreground">
                        {column.enumValues.join(" · ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {column.primary && <Badge variant="secondary">PK</Badge>}
                      {table.foreignKeys.some((key) => key.columns.includes(column.name)) && (
                        <Badge variant="outline">FK</Badge>
                      )}
                      {column.unique && <Badge variant="outline">UNIQUE</Badge>}
                      <Badge variant="outline">{column.nullable ? "NULL" : "NOT NULL"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code dir="ltr">{column.default ?? "—"}</code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <section className="flex flex-col gap-2" aria-label="علاقات الجدول">
            <h2 className="text-sm font-semibold">العلاقات ({relationships.length})</h2>
            {relationships.map((edge) => (
              <div key={edge.name} className="flex flex-wrap items-center gap-2 text-xs" dir="ltr">
                <Button variant="outline" size="sm" onClick={() => onSelect(edge.source)}>
                  {edge.source}
                </Button>
                <code>({edge.columns.join(", ")}) →</code>
                <Button variant="outline" size="sm" onClick={() => onSelect(edge.target)}>
                  {edge.target}
                </Button>
                <code>({edge.targetColumns.join(", ")})</code>
                <Badge variant="secondary">DELETE {edge.onDelete}</Badge>
                <Badge variant="outline">UPDATE {edge.onUpdate}</Badge>
              </div>
            ))}
            {relationships.length === 0 && (
              <p className="text-sm text-muted-foreground">
                لا توجد مفاتيح خارجية معلنة لهذا الجدول.
              </p>
            )}
          </section>
          <section className="flex flex-col gap-2" aria-label="فهارس وقيود الجدول">
            <h2 className="text-sm font-semibold">الفهارس والقيود</h2>
            <ul className="flex flex-col gap-2 text-xs" dir="ltr">
              {table.indexes.map((index) => (
                <li key={index.name}>
                  <code>
                    {index.name}: {index.unique ? "UNIQUE " : ""}
                    {index.method} ({index.columns.join(", ")})
                    {index.where ? ` WHERE ${index.where}` : ""}
                  </code>
                </li>
              ))}
              {table.uniqueConstraints.map((constraint) => (
                <li key={constraint.name}>
                  <code>
                    {constraint.name}: UNIQUE ({constraint.columns.join(", ")})
                  </code>
                </li>
              ))}
              {table.checks.map((check) => (
                <li key={check.name}>
                  <code>
                    {check.name}: CHECK {check.expression}
                  </code>
                </li>
              ))}
            </ul>
            {table.indexes.length + table.uniqueConstraints.length + table.checks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                لا توجد فهارس إضافية أو قيود تحقق معلنة.
              </p>
            )}
          </section>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          عرض المخطط فقط. المفاتيح المركبة تظهر بجميع حقولها في تفاصيل العلاقة.
        </p>
      </CardFooter>
    </Card>
  );
}
