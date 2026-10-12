import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RefreshCw } from "lucide-react";
import { z } from "zod";

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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { nativeCall } from "@/lib/bridge";

import { formatSourceSize } from "./source-format";

const quantity = z.number().finite().nonnegative();
const stateLabels = {
  metadata_pending: "جارٍ جلب معلومات التورنت",
  checking: "جارٍ التحقق من الملفات",
  paused: "متوقف مؤقتًا",
  downloading: "جارٍ التنزيل",
  complete: "اكتمل نقل التورنت",
  missing: "ملفات التنزيل مفقودة",
  blocked: "التنزيل محظور",
  failed: "تعذّر التنزيل",
} as const;
const JobsSchema = z
  .array(
    z.object({
      id: z.string(),
      selected: z.array(z.number().int().nonnegative()),
      files: z.array(
        z.object({ index: z.number().int().nonnegative(), path: z.string(), size: quantity }),
      ),
      status: z.object({
        verified: quantity,
        total: quantity,
        complete: z.boolean(),
        paused: z.boolean(),
        error: z.string().nullable(),
        state: z.enum([
          "metadata_pending",
          "checking",
          "paused",
          "downloading",
          "complete",
          "missing",
          "blocked",
          "failed",
        ]),
        download_rate: quantity,
        peers: quantity,
      }),
      exports: z.array(
        z.object({
          file: z.number().int().nonnegative(),
          path: z.string(),
          available: z.boolean(),
          published: z.boolean(),
          error: z.string().nullable(),
        }),
      ),
    }),
  )
  .max(64);
export function downloadQueueOptions() {
  return queryOptions({
    queryKey: ["native", "downloads", "queue"] as const,
    queryFn: async ({ signal }) => JobsSchema.parse(await nativeCall("media.jobs", {}, signal)),
    networkMode: "always",
    retry: false,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });
}

export function DownloadQueue() {
  const client = useQueryClient();
  const jobs = useQuery(downloadQueueOptions());
  const action = useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) =>
      z
        .object({ ok: z.literal(true) })
        .parse(await nativeCall(paused ? "media.resume" : "media.pause", { id })),
    onSuccess: () => client.invalidateQueries({ queryKey: ["native", "downloads"] }),
    networkMode: "always",
    retry: false,
  });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        يُحفظ الفيديو في Videos/nahhasio داخل مجلد العمل بعد اكتمال النقل والتحقق والحفظ. يُستأنف
        التنزيل المحفوظ عند إعادة فتح التطبيق.
      </p>
      {jobs.isPending && <p role="status">جارٍ تحميل التنزيلات…</p>}
      {(jobs.error || action.error) && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحديث التنزيلات</AlertTitle>
          <AlertDescription>{(jobs.error ?? action.error)?.message}</AlertDescription>
        </Alert>
      )}
      {jobs.data?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد تنزيلات</EmptyTitle>
            <EmptyDescription>اختر تنزيلًا من صفحة العمل أو الحلقة.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {jobs.data?.map((job) => {
        const { status } = job;
        const ready = job.exports.every((file) => file.available);
        const exportError = job.exports.find((file) => file.error)?.error;
        const missing = job.exports.some((file) => file.published && !file.available);
        const percent =
          status.total > 0 ? Math.min(100, (status.verified / status.total) * 100) : 0;
        const label = ready
          ? "محفوظ وجاهز للمشاهدة"
          : missing
            ? "الفيديو المحفوظ مفقود أو تغيّر"
            : exportError
              ? "تعذّر حفظ الفيديو"
              : status.complete
                ? "جارٍ حفظ الفيديو في Videos"
                : status.state === "downloading" && status.download_rate === 0
                  ? status.peers === 0
                    ? "بانتظار الاتصال بالمشاركين"
                    : "بانتظار وصول البيانات"
                  : stateLabels[status.state];
        const eta =
          status.download_rate > 0 && !status.complete
            ? Math.ceil(Math.max(0, status.total - status.verified) / status.download_rate / 60)
            : null;
        const recoverable = !["missing", "blocked", "failed"].includes(status.state);
        return (
          <Card key={job.id} size="sm">
            <CardHeader>
              <CardTitle>
                <h3 dir="auto" className="wrap-anywhere">
                  {job.files
                    .filter((file) => job.exports.some((saved) => saved.file === file.index))
                    .map((file) => file.path.split("/").at(-1))
                    .join(" · ") || "تنزيل فيديو"}
                </h3>
              </CardTitle>
              <CardDescription>
                <Badge
                  variant={exportError || status.error || missing ? "destructive" : "secondary"}
                >
                  {label}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-3">
              <Progress
                className="download-progress h-2 accent-primary rounded-lg w-full"
                value={status.total > 0 ? percent : null}
                max={100}
                aria-label="تقدم التنزيل"
              />
              <div className="flex flex-wrap justify-between gap-2 text-sm" dir="auto">
                <span>
                  {percent.toFixed(1)}% · {formatSourceSize(status.verified)} /{" "}
                  {formatSourceSize(status.total)}
                </span>
                <span>
                  {formatSourceSize(status.download_rate)}/s · {status.peers} مشارك
                </span>
              </div>
              {eta !== null && (
                <p className="text-sm text-muted-foreground">
                  الوقت المتبقي التقريبي: {Math.max(1, eta)} دقيقة
                </p>
              )}
              {job.exports.map((file) => (
                <p
                  key={file.file}
                  dir="auto"
                  className="text-sm wrap-anywhere text-muted-foreground"
                >
                  {file.path}
                </p>
              ))}
              {(exportError || status.error || missing) && (
                <Alert variant="destructive">
                  <AlertTitle>{label}</AlertTitle>
                  <AlertDescription>
                    <p className="wrap-anywhere">
                      {exportError ?? status.error ?? "تحقق من وجود الفيديو في مسار الحفظ."}
                    </p>
                    {exportError && (
                      <p>
                        تحقق من المساحة والصلاحيات وتعارض اسم الملف. يعيد التطبيق محاولة الحفظ
                        تلقائيًا.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              {!status.complete && recoverable && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: job.id, paused: status.paused })}
                >
                  {status.paused ? (
                    <Play data-icon="inline-start" />
                  ) : (
                    <Pause data-icon="inline-start" />
                  )}
                  {action.isPending && action.variables?.id === job.id
                    ? "جارٍ التحديث…"
                    : status.paused
                      ? "استئناف التنزيل"
                      : "إيقاف مؤقت"}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
      <Button
        variant="ghost"
        disabled={jobs.isFetching}
        onClick={() => {
          action.reset();
          void jobs.refetch();
        }}
      >
        <RefreshCw data-icon="inline-start" />
        تحديث التنزيلات
      </Button>
    </div>
  );
}
