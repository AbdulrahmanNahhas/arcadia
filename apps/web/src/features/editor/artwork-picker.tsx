import type { WorkDocument } from "@arcadia/cli/work";
import type { artworkSearchQuerySchema } from "@arcadia/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { DownloadIcon, SearchIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ingestArtwork, searchArtwork, uploadArtwork } from "@/features/database/artwork.functions";
import { databaseKeys } from "@/features/database/database.queries";

import { artworkContext } from "./artwork-model";
import { SelectField } from "./work-fields";

type Installment = NonNullable<WorkDocument["installments"]>[number];
type Role = "poster" | "banner" | "logo";
export function ArtworkPicker({
  work,
  installment,
  role,
  onPick,
}: {
  work: WorkDocument;
  installment?: Installment;
  role: Role;
  onPick: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <DownloadIcon data-icon="inline-start" />
        المصادر أو رفع صورة
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              اختيار صورة: {installment?.title ?? work.titleAr ?? work.canonicalTitle}
            </DialogTitle>
            <DialogDescription>
              اختر من المصادر أو ارفع صورة. يبقى الاختيار في المسودة حتى الحفظ.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <ArtworkResults
              work={work}
              installment={installment}
              role={role}
              onPick={(path) => {
                onPick(path);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function ArtworkResults({
  work,
  installment,
  role,
  onPick,
}: {
  work: WorkDocument;
  installment?: Installment;
  role: Role;
  onPick: (path: string) => void;
}) {
  const context = artworkContext(work, installment);
  const input: z.infer<typeof artworkSearchQuerySchema> = {
    title: context.title,
    year: context.year,
    seriesTitle: context.seriesTitle,
    kind: context.kind,
    tmdbId: context.tmdbId,
    anilistId: context.anilistId,
    season: context.season,
    role,
  };
  const [provider, setProvider] = useState("all");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const client = useQueryClient();
  async function picked(result: Awaited<ReturnType<typeof ingestArtwork>>) {
    await client.invalidateQueries({ queryKey: databaseKeys.records("media_assets") });
    onPick(z.string().parse(result.path));
  }
  const search = useMutation({
    mutationFn: (query: z.infer<typeof artworkSearchQuerySchema>) => searchArtwork({ data: query }),
    onSuccess: () => {
      setProvider("all");
      setResultsOpen(true);
    },
  });
  const ingest = useMutation({
    mutationFn: (url: string) => ingestArtwork({ data: { url, role, ownerName: context.title } }),
    onSuccess: picked,
  });
  const upload = useMutation({
    mutationFn: async (value: File) => {
      if (value.size > 10000000) throw new Error("الحد الأقصى للصورة 10 ميغابايت.");
      if (!value.type.startsWith("image/")) throw new Error("اختر ملف صورة.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(z.string().parse(reader.result)), {
          once: true,
        });
        reader.addEventListener("error", () => reject(new Error("تعذّرت قراءة الصورة.")), {
          once: true,
        });
        reader.readAsDataURL(value);
      });
      return uploadArtwork({
        data: { dataUrl, fileName: value.name, role, ownerName: context.title },
      });
    },
    onSuccess: picked,
  });
  const busy = ingest.isPending || upload.isPending;
  const candidates =
    search.data?.candidates.filter(
      (candidate) => provider === "all" || candidate.provider === provider,
    ) ?? [];
  const error = search.error ?? ingest.error ?? upload.error;
  return (
    <div className="flex max-h-dvh min-w-0 flex-col gap-4 overflow-y-auto">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّرت العملية</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">TMDB · Fanart · AniList</TabsTrigger>
          <TabsTrigger value="upload">رفع من الجهاز</TabsTrigger>
        </TabsList>
        <TabsContent value="providers">
          <FieldGroup>
            <div className="flex flex-wrap gap-2">
              {context.sources
                .filter((source) => source.value)
                .map((source) => (
                  <Badge key={source.key} variant="outline">
                    {source.key.replace("Id", "")}: {source.value}
                  </Badge>
                ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                search.mutate(input);
              }}
            >
              <FieldGroup>
                <p className="text-sm text-muted-foreground">
                  البحث تلقائي بالمعرّفات المتاحة، ثم باسم العمل:{" "}
                  <span dir="auto">{context.seriesTitle ?? context.title}</span>.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <Button type="submit" disabled={search.isPending || busy || !input.title.trim()}>
                    <SearchIcon data-icon="inline-start" />
                    {search.isPending ? "جارٍ البحث…" : "البحث عن الصور"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
            {search.data && (
              <div className="flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setResultsOpen(true)}
                >
                  عرض النتائج السابقة ({search.data.candidates.length})
                </Button>
              </div>
            )}
            <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
              <DialogContent className="flex h-11/12 flex-col sm:max-w-5xl">
                <DialogHeader>
                  <DialogTitle>نتائج البحث عن الصور</DialogTitle>
                  <DialogDescription>
                    {search.variables?.title} · {search.data?.candidates.length ?? 0} صورة
                  </DialogDescription>
                </DialogHeader>
                {ingest.isError && (
                  <Alert variant="destructive">
                    <AlertTitle>تعذّر الاستيراد</AlertTitle>
                    <AlertDescription>{ingest.error.message}</AlertDescription>
                  </Alert>
                )}
                {search.data?.warnings.length ? (
                  <Alert>
                    <AlertTitle>بعض المصادر غير متاحة</AlertTitle>
                    <AlertDescription>{search.data.warnings.join(" · ")}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="w-48 h-min">
                  <SelectField
                    label="عرض المصدر"
                    value={provider}
                    items={[
                      { value: "all", label: "كل المصادر" },
                      { value: "tmdb", label: "TMDB" },
                      { value: "fanart", label: "Fanart" },
                      { value: "anilist", label: "AniList" },
                    ]}
                    onChange={setProvider}
                  />
                </div>
                {search.isSuccess && !candidates.length && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>لا توجد صور مطابقة</EmptyTitle>
                      <EmptyDescription>
                        لم تُرجع المصادر صوراً لهذا الاختيار. راجع معرّفات الجزء والعمل في المحرّر، ولا
                        يوفر AniList شعارات.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                <div className="grid min-h-0 flex-1 items-start gap-2 overflow-y-auto grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {candidates.map((candidate) => (
                    <div
                      key={candidate.downloadUrl}
                      className="flex min-w-0 flex-col gap-2 rounded-lg border p-2"
                    >
                      <img
                        src={candidate.previewUrl}
                        alt={candidate.matchLabel}
                        loading="lazy"
                        className={cn(
                          "w-full object-contain",
                          role === "poster" && "aspect-2/3",
                          role === "banner" && "aspect-video",
                          role === "logo" && "aspect-square",
                        )}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{candidate.provider}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {candidate.width ?? "?"} × {candidate.height ?? "?"} ·{" "}
                          {candidate.language ?? "بلا لغة"}
                        </span>
                      </div>
                      <p dir="auto" title={candidate.matchLabel} className="truncate text-xs">
                        {candidate.matchLabel}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => ingest.mutate(candidate.downloadUrl)}
                      >
                        {ingest.isPending && ingest.variables === candidate.downloadUrl
                          ? "جارٍ الاستيراد…"
                          : "استيراد واختيار"}
                      </Button>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </FieldGroup>
        </TabsContent>
        <TabsContent value="upload">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="work-artwork-upload">ملف الصورة</FieldLabel>
              <Input
                id="work-artwork-upload"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            <p className="text-sm text-muted-foreground">
              تُضاف الصورة إلى المكتبة ثم تُختار في المسودة. الحد الأقصى 10 ميغابايت.
            </p>
            <Button
              type="button"
              disabled={!file || busy}
              onClick={() => {
                if (file) upload.mutate(file);
              }}
            >
              <UploadIcon data-icon="inline-start" />
              {upload.isPending ? "جارٍ الرفع…" : "رفع واختيار"}
            </Button>
          </FieldGroup>
        </TabsContent>
      </Tabs>
    </div>
  );
}
