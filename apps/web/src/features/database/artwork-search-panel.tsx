import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { searchArtwork, ingestArtwork, getTmdbSeason } from "./artwork.functions";
import { databaseKeys } from "./database.queries";

const roles = [
  { value: "poster", label: "ملصق" },
  { value: "banner", label: "خلفية" },
  { value: "logo", label: "شعار" },
];
export function ArtworkSearchPanel() {
  const [role, setRole] = useState<"poster" | "banner" | "logo">("poster");
  const [title, setTitle] = useState("");
  const client = useQueryClient();
  const search = useMutation({
    mutationFn: (name: string) => searchArtwork({ data: { title: name, role } }),
  });
  const ingest = useMutation({
    mutationFn: (url: string) => ingestArtwork({ data: { url, role, ownerName: title } }),
    onSuccess: () => client.invalidateQueries({ queryKey: databaseKeys.records("media_assets") }),
  });
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>البحث في TMDB وFanart وAniList</CardTitle>
          <CardDescription>صور المصادر المتاحة، مع معاينة قبل تسجيل أي صورة.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("title") ?? "");
              setTitle(name);
              search.mutate(name);
            }}
          >
            <FieldGroup className="grid md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="artwork-title">اسم العمل</FieldLabel>
                <Input id="artwork-title" name="title" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="artwork-role">نوع الصورة</FieldLabel>
                <Select
                  items={roles}
                  value={role}
                  onValueChange={(value) => {
                    if (value === "poster" || value === "banner" || value === "logo")
                      setRole(value);
                  }}
                >
                  <SelectTrigger id="artwork-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {roles.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" disabled={search.isPending}>
                {" "}
                {search.isPending ? "جارٍ البحث…" : "البحث عن الصور"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            النتائج تعتمد على مفاتيح المصادر المضبوطة في الخادم.
          </p>
        </CardFooter>
      </Card>
      {(search.isError || ingest.isError) && (
        <Alert variant="destructive">
          <AlertTitle>تعذّرت العملية</AlertTitle>
          <AlertDescription>{search.error?.message ?? ingest.error?.message}</AlertDescription>
        </Alert>
      )}
      {ingest.isSuccess && (
        <Alert>
          <AlertTitle>حُفظت الصورة</AlertTitle>
          <AlertDescription>الصورة مسجلة في مكتبة الوسائط ويمكن ربطها بسجل.</AlertDescription>
        </Alert>
      )}
      {search.data?.warnings.length ? (
        <Alert>
          <AlertTitle>بعض المصادر غير متاحة</AlertTitle>
          <AlertDescription>{search.data.warnings.join(" · ")}</AlertDescription>
        </Alert>
      ) : null}
      {search.isSuccess && search.data.candidates.length === 0 && (
        <Alert>
          <AlertTitle>لا توجد صور مطابقة</AlertTitle>
          <AlertDescription>راجع الاسم ومفاتيح TMDB وFanart.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {search.data?.candidates.map((candidate) => (
          <Card key={candidate.downloadUrl}>
            <CardHeader>
              <CardTitle>{candidate.matchLabel}</CardTitle>
              <CardDescription>
                <Badge variant="outline">{candidate.provider}</Badge> · {candidate.width} ×{" "}
                {candidate.height}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <img
                src={candidate.previewUrl}
                alt={candidate.matchLabel}
                loading="lazy"
                className="h-64 w-full object-contain"
              />
            </CardContent>
            <CardFooter>
              <Button
                disabled={ingest.isPending}
                onClick={() => ingest.mutate(candidate.downloadUrl)}
              >
                حفظ في مكتبة الصور
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <SeasonPreview />
    </>
  );
}
function SeasonPreview() {
  const preview = useMutation({
    mutationFn: ({ tmdbId, season }: { tmdbId: number; season: number }) =>
      getTmdbSeason({ data: { tmdbId, season } }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>معاينة موسم TMDB</CardTitle>
        <CardDescription>
          مراجعة بيانات الحلقات قبل إضافتها في محرر العمل أو جدول الحلقات.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            preview.mutate({
              tmdbId: Number(form.get("tmdbId")),
              season: Number(form.get("season")),
            });
          }}
        >
          <FieldGroup className="grid sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="tmdb-season-id">معرّف المسلسل</FieldLabel>
              <Input id="tmdb-season-id" name="tmdbId" type="number" min={1} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="tmdb-season-number">رقم الموسم</FieldLabel>
              <Input
                id="tmdb-season-number"
                name="season"
                type="number"
                min={0}
                defaultValue={1}
                required
              />
            </Field>
            <Button type="submit" disabled={preview.isPending}>
              جلب المعاينة
            </Button>
          </FieldGroup>
        </form>
        {preview.isError && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر جلب الموسم</AlertTitle>
            <AlertDescription>{preview.error.message}</AlertDescription>
          </Alert>
        )}
        {preview.data && (
          <pre className="max-h-96 overflow-auto" dir="ltr">
            {JSON.stringify(preview.data, null, 2)}
          </pre>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">جلب المعاينة لا يغيّر السجلات الحالية.</p>
      </CardFooter>
    </Card>
  );
}
