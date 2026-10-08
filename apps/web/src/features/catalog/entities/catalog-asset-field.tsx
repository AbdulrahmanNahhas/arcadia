import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { useId, useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { DatabaseRow } from "@/features/database/data/database-model";
import { databaseRecordsOptions } from "@/features/database/data/database.queries";

const assetSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  original_filename: z.string(),
  width: z.number(),
  height: z.number(),
});

function parseAsset(row: DatabaseRow) {
  const parsed = assetSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

function AssetPreview({ path, name }: { path: string; name: string }) {
  return (
    <span className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted">
      {path.startsWith("/media/") ? (
        <img src={path} alt={name} className="size-full object-contain" loading="lazy" />
      ) : (
        <span className="text-sm text-muted-foreground">لا توجد معاينة</span>
      )}
    </span>
  );
}

export function CatalogAssetField({
  label,
  value,
  onChange,
  nullable = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  nullable?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const assets = useQuery(databaseRecordsOptions("media_assets", offset, search));
  const selected = useQuery({
    ...databaseRecordsOptions("media_assets", 0, "", value ? { id: value } : {}),
    enabled: Boolean(value),
  });
  const chosen = selected.data?.rows.map(parseAsset).find((asset) => asset?.id === value) ?? null;

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-search`}>{label}</FieldLabel>
      <FieldDescription>
        اختر صورة موجودة من مكتبة الصور. سيُحفظ معرّفها الثابت في السجل.
      </FieldDescription>
      {value && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>الصورة الحالية</CardTitle>
            <CardDescription>{chosen?.original_filename ?? "الصورة المحددة"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {chosen && <AssetPreview path={chosen.path} name={chosen.original_filename} />}
              <code className="break-all text-xs text-muted-foreground" dir="ltr">
                {value}
              </code>
              {nullable && (
                <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
                  إزالة الاختيار
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {selected.isError && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل الصورة الحالية</AlertTitle>
          <AlertDescription>{selected.error.message}</AlertDescription>
        </Alert>
      )}
      {selected.isSuccess && value && !chosen && (
        <Alert variant="destructive">
          <AlertTitle>الصورة الحالية غير موجودة في المكتبة</AlertTitle>
          <AlertDescription>اختر صورة أخرى لتحديث هذا الربط.</AlertDescription>
        </Alert>
      )}
      <Input
        id={`${id}-search`}
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setOffset(0);
        }}
        placeholder="ابحث باسم الملف أو مساره"
      />
      {assets.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل مكتبة الصور</AlertTitle>
          <AlertDescription>{assets.error.message}</AlertDescription>
        </Alert>
      ) : assets.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          جارٍ تحميل الصور…
        </p>
      ) : assets.data.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد صور مطابقة</EmptyTitle>
            <EmptyDescription>غيّر البحث أو أضف الصورة إلى مكتبة الصور أولاً.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.data.rows.map((row) => {
              const asset = parseAsset(row);
              if (!asset) return null;
              const isSelected = asset.id === value;
              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={cn(buttonVariants({ variant: "outline" }), "h-auto w-full")}
                  onClick={() => onChange(asset.id)}
                >
                  <span className="flex w-full flex-col items-start gap-2">
                    <AssetPreview path={asset.path} name={asset.original_filename} />
                    <span className="flex w-full min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-start">{asset.original_filename}</span>
                      {isSelected && <Badge variant="secondary">محددة</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {asset.width} × {asset.height}
                    </span>
                    <code
                      className="w-full truncate text-start text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      {asset.id}
                    </code>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {assets.data.total.toLocaleString("ar")} صورة · عرض {offset + 1}–
              {Math.min(offset + assets.data.rows.length, assets.data.total)}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!offset || assets.isFetching}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                السابق
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  offset + assets.data.rows.length >= assets.data.total || assets.isFetching
                }
                onClick={() => setOffset(offset + 50)}
              >
                التالي
              </Button>
            </div>
          </div>
        </>
      )}
    </Field>
  );
}
