import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getCatalogCounts } from "./catalog-counts.functions";

const countSources = [
  { key: "works", label: "الأعمال", description: "عناوين المكتبة" },
  { key: "people", label: "الأشخاص", description: "الأسماء المسجلة" },
  { key: "studios", label: "الاستوديوهات", description: "الجهات المشاركة" },
  { key: "planets", label: "العوالم", description: "العوالم والسلاسل" },
  { key: "mediaAssets", label: "ملفات الصور", description: "الأصول المسجلة" },
] as const;

export function CatalogCountCards() {
  const counts = useQuery({
    queryKey: ["database", "catalog", "counts"],
    queryFn: () => getCatalogCounts(),
  });

  if (counts.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذّر تحميل أعداد المكتبة</AlertTitle>
        <AlertDescription>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{counts.error.message}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={counts.isFetching}
              onClick={() => void counts.refetch()}
            >
              إعادة المحاولة
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {countSources.map((source) => {
        const count = counts.data?.[source.key];
        const value = count === undefined ? "…" : count.toLocaleString("ar");

        return (
          <Card key={source.key} size="sm">
            <CardHeader>
              <CardDescription>{source.label}</CardDescription>
              <CardTitle aria-live="polite">{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{source.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
