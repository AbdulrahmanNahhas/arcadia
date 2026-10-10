import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderDown } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { nativeCall } from "@/lib/bridge";

import { choiceKey, playSource, sourceOptions, type FileChoice } from "./playback";
import type { PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

export function SourceControls({
  target,
  player,
}: {
  target: WatchTarget | null;
  player: PlayerController;
}) {
  const client = useQueryClient();
  const sessionId = player.snapshot?.sessionId ?? "";
  const sources = useQuery({
    ...sourceOptions(
      sessionId,
      target ?? { workId: "00000000-0000-0000-0000-000000000000", title: "Video" },
    ),
    enabled: Boolean(sessionId && target),
  });
  const choice = useQuery<FileChoice | null>({
    queryKey: choiceKey(sessionId),
    queryFn: () => null,
    enabled: false,
  });
  const play = useMutation({
    mutationKey: ["native", "source", sessionId],
    mutationFn: ({ sourceId, fileIndex }: { sourceId: string; fileIndex?: number }) =>
      playSource(client, sessionId, sourceId, fileIndex),
  });
  const keep = useMutation({
    mutationFn: () => nativeCall("media.keep", { sessionId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["native", "downloads"] }),
  });
  const error = play.error ?? sources.error ?? keep.error;
  return (
    <div className="flex flex-col gap-4">
      {player.snapshot?.sourceKind === "torrent" && (
        <Button
          variant="outline"
          disabled={keep.isPending || keep.isSuccess}
          onClick={() => keep.mutate()}
        >
          <FolderDown data-icon="inline-start" />
          {keep.isPending
            ? "جارٍ تثبيت التنزيل…"
            : keep.isSuccess
              ? "أُضيف إلى قائمة التنزيل"
              : "الاحتفاظ بتنزيل الفيديو"}
        </Button>
      )}
      <p className="player-note">
        Torrentio · بيانات الجودة واللغة مبلّغ عنها؛ الصوت والترجمة يُتحققان بعد فتح الفيديو.
      </p>
      {(sources.isFetching || play.isPending || player.snapshot?.buffering) && (
        <p role="status">جارٍ جلب المصدر والتحقق من بيانات الفيديو…</p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر فتح المصدر</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {choice.data && (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">اختر ملف الفيديو</h3>
          <p className="player-note">المصدر لا يحدد ملفًا واحدًا؛ لن يُختار أكبر ملف تلقائيًا.</p>
          {choice.data.files.map((file) => (
            <Button
              key={file.index}
              variant="outline"
              disabled={play.isPending}
              className="h-auto justify-start text-start whitespace-normal"
              onClick={() =>
                play.mutate({ sourceId: choice.data!.sourceId, fileIndex: file.index })
              }
            >
              <span dir="auto" className="wrap-anywhere">
                {file.path} · {(file.size / 1e9).toFixed(2)} GB
              </span>
            </Button>
          ))}
        </section>
      )}
      {sources.data?.candidates.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد مصادر من Torrentio لهذا الإصدار</EmptyTitle>
            <EmptyDescription>يمكنك إعادة البحث لاحقًا أو فتح فيديو محلي.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {sources.data?.candidates.map((candidate) => (
        <article
          key={candidate.id}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <h3 className="font-semibold" dir="auto">
            {candidate.label}
          </h3>
          <p className="text-sm wrap-anywhere" dir="auto">
            {candidate.release}
          </p>
          <div className="flex flex-wrap gap-2">
            {candidate.resolution && <Badge variant="secondary">{candidate.resolution}p</Badge>}
            {candidate.codec && <Badge variant="outline">{candidate.codec}</Badge>}
            {candidate.hdr && <Badge variant="outline">HDR مبلّغ عنه</Badge>}
            {candidate.sizeBytes !== null && (
              <Badge variant="outline">{(candidate.sizeBytes / 1e9).toFixed(2)} GB</Badge>
            )}
            {candidate.seeders !== null && (
              <Badge variant="outline">{candidate.seeders} مشارك مبلّغ عنه</Badge>
            )}
          </div>
          <p className="player-note">
            اللغات المبلّغ عنها:{" "}
            {candidate.reportedLanguages.length
              ? candidate.reportedLanguages
                  .map(
                    (language) =>
                      new Intl.DisplayNames(["ar"], { type: "language" }).of(language) ?? language,
                  )
                  .join(" · ")
              : "غير معروفة"}
            ؛ لا تُثبت وجود دبلجة أو ترجمة.
          </p>
          <Button
            variant="outline"
            disabled={!candidate.available || play.isPending}
            onClick={() => play.mutate({ sourceId: candidate.id })}
          >
            {candidate.available ? "تشغيل هذا المصدر" : "مصدر مباشر — يُضاف عبر محوّل لاحقًا"}
          </Button>
        </article>
      ))}
      {target && (
        <Button
          variant="ghost"
          disabled={sources.isFetching}
          onClick={() => void sources.refetch()}
        >
          إعادة البحث عن مصادر
        </Button>
      )}
    </div>
  );
}
