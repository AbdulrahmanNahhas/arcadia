import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { PageHeader } from "@/components/dashboard/page-header";
import { RecordTable } from "@/components/dashboard/record-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { databaseRecordsOptions } from "@/features/database/data/database.queries";
const assetPreview = z.object({
  id: z.string(),
  path: z.string(),
  original_filename: z.string(),
  width: z.number(),
  height: z.number(),
});
export function ImagesPage() {
  const [offset, setOffset] = useState(0);
  const images = useQuery(databaseRecordsOptions("media_assets", offset));
  return (
    <>
      <PageHeader
        title="مكتبة الصور"
        description="الصور الحقيقية والملصقات والخلفيات والشعارات وروابطها بالسجلات."
        eyebrow="قاعدة البيانات / الوسائط"
      />
      <Tabs defaultValue="gallery">
        <TabsList>
          <TabsTrigger value="gallery">معرض الصور</TabsTrigger>
          <TabsTrigger value="records">سجلات الصور</TabsTrigger>
          <TabsTrigger value="assignments">روابط الصور</TabsTrigger>
        </TabsList>
        <TabsContent value="gallery">
          {images.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر تحميل الصور</AlertTitle>
              <AlertDescription>{images.error.message}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {images.data?.rows.map((row) => {
              const asset = assetPreview.parse(row);
              return (
                <Card key={asset.id}>
                  <CardHeader>
                    <CardTitle>
                      <span className="block truncate">{asset.original_filename}</span>
                    </CardTitle>
                    <CardDescription>
                      {asset.width} × {asset.height}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <img
                      src={asset.path}
                      alt={asset.original_filename}
                      className="h-64 w-full object-contain"
                      loading="lazy"
                    />
                  </CardContent>
                  <CardFooter>
                    <code className="max-w-full truncate text-xs" dir="ltr">
                      {asset.id}
                    </code>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 py-4">
            <span className="text-sm text-muted-foreground">
              {images.data?.total ?? "…"} صورة مسجلة
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                السابق
              </Button>
              <Button
                variant="outline"
                disabled={!images.data || offset + 50 >= images.data.total}
                onClick={() => setOffset(offset + 50)}
              >
                التالي
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="records">
          <RecordTable table="media_assets" title="الصور المسجلة" columns={[]} />
        </TabsContent>
        <TabsContent value="assignments">
          <RecordTable table="media_asset_assignments" title="ربط الصور بالسجلات" columns={[]} />
        </TabsContent>
      </Tabs>
    </>
  );
}
