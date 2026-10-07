import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { applyTmdbSeason, episodeKeys, tmdbSeasonPreviewQueryOptions } from "./api";

/**
 * "جلب من TMDB": previews `/tv/{id}/season/{n}` (Arabic first, English fallback per field)
 * against the season's current episodes, then applies with the chosen policy. The preview is
 * the point — nothing is written until the admin has seen what will change.
 */
export function TmdbImportDialog({
  installmentId,
  defaultSeason,
  tmdbId,
  open,
  onOpenChange,
}: {
  installmentId: string;
  defaultSeason: number;
  tmdbId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [seasonText, setSeasonText] = useState(String(defaultSeason));
  const season = Number.parseInt(seasonText, 10);
  const seasonValid = Number.isInteger(season) && season >= 0;
  const [mode, setMode] = useState<"fill" | "overwrite">("fill");
  const [stills, setStills] = useState(true);
  const [createMissing, setCreateMissing] = useState(true);
  const preview = useQuery({
    ...tmdbSeasonPreviewQueryOptions(installmentId, seasonValid ? season : null),
    enabled: open && seasonValid && tmdbId !== null,
  });
  const apply = useMutation({
    mutationFn: () => applyTmdbSeason(installmentId, { season, mode, stills, createMissing }),
    onSuccess: (result) => {
      queryClient.setQueryData(episodeKeys.season(installmentId), result);
      void queryClient.invalidateQueries({ queryKey: episodeKeys.season(installmentId) });
    },
  });

  const failure =
    preview.error instanceof ApiError
      ? preview.error.message
      : preview.error instanceof Error
        ? "تعذّر الوصول إلى TMDB."
        : null;
  const newCount =
    preview.data?.episodes.filter((episode) => episode.existingId === null).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>جلب الحلقات من TMDB</DialogTitle>
          <DialogDescription>
            {tmdbId === null
              ? "العنوان لا يحمل معرّف TMDB بعد — أضفه من نموذج العمل أولاً."
              : `المعرّف ${tmdbId}. العربية أولاً، ثم الإنجليزية لما لم يُترجَم.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="tmdb-season" className="text-xs text-muted-foreground">
              رقم الموسم على TMDB
            </label>
            <Input
              id="tmdb-season"
              dir="ltr"
              inputMode="numeric"
              value={seasonText}
              onChange={(event) => setSeasonText(event.target.value)}
              className="h-9 w-24 font-mono"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Button
              type="button"
              size="sm"
              variant={mode === "fill" ? "default" : "outline"}
              onClick={() => setMode("fill")}
            >
              املأ الفارغ فقط
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "overwrite" ? "default" : "outline"}
              onClick={() => setMode("overwrite")}
            >
              استبدل الموجود
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="tmdb-stills"
              checked={stills}
              onCheckedChange={(value) => setStills(value === true)}
            />
            <label htmlFor="tmdb-stills">صور الحلقات</label>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="tmdb-create"
              checked={createMissing}
              onCheckedChange={(value) => setCreateMissing(value === true)}
            />
            <label htmlFor="tmdb-create">أنشئ الحلقات الناقصة</label>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
          {preview.isPending && tmdbId !== null ? (
            <p className="p-4 text-center text-sm text-muted-foreground">جارٍ الجلب…</p>
          ) : failure ? (
            <p className="p-4 text-center text-sm text-destructive">{failure}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">#</th>
                  <th className="p-2 text-start">العنوان</th>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">المدة</th>
                  <th className="p-2 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {preview.data?.episodes.map((episode) => (
                  <tr key={episode.number} className="border-t border-border/60 align-top">
                    <td className="p-2 font-mono">{episode.number}</td>
                    <td className="p-2">
                      <div className="flex items-start gap-2">
                        {episode.stillUrl && (
                          <img
                            src={episode.stillUrl}
                            alt=""
                            width={64}
                            height={36}
                            loading="lazy"
                            decoding="async"
                            className="h-9 w-16 shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="truncate">{episode.title ?? "—"}</div>
                          <div className="line-clamp-2 text-xs text-muted-foreground">
                            {episode.summary}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap font-mono text-xs">
                      {episode.releaseDate ?? "—"}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {episode.runtimeMinutes ? `${episode.runtimeMinutes} د` : "—"}
                    </td>
                    <td className="p-2 text-xs">
                      {episode.existingId ? (
                        <span className="text-muted-foreground">
                          موجودة — {mode === "fill" ? "يُملأ الفارغ" : "تُستبدل"}
                        </span>
                      ) : (
                        <span className={createMissing ? "text-primary" : "text-muted-foreground"}>
                          {createMissing ? "ستُنشأ" : "تُتجاهل"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="items-center">
          {apply.isSuccess && (
            <p className="me-auto text-xs text-muted-foreground">
              حُدِّثت {apply.data.applied.updated}، أُنشئت {apply.data.applied.created}، صور{" "}
              {apply.data.applied.stillsSaved}.
            </p>
          )}
          {apply.isError && (
            <p className="me-auto text-xs text-destructive">
              {apply.error instanceof Error ? apply.error.message : "تعذّر التطبيق."}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button
            disabled={!preview.data || apply.isPending || tmdbId === null}
            onClick={() => apply.mutate()}
          >
            {apply.isPending
              ? "جارٍ التطبيق…"
              : `طبّق (${preview.data?.episodes.length ?? 0} حلقة، ${newCount} جديدة)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
