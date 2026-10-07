import { ArrowClockwiseIcon, CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/features/library/player/format";
import { healthQueryOptions } from "../maintenance/api";

const dateTime = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

function ago(iso: string | null) {
  if (!iso) return "لم يحدث بعد";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

function uptime(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} ساعة`;
  return `${Math.round(seconds / 86400)} يوماً`;
}

/** The overview's "الخادم" card — sizes, migrations, integrations, last maintenance runs. */
export function ServerHealthCard() {
  const health = useQuery(healthQueryOptions());
  const data = health.data;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>الخادم</CardTitle>
            <CardDescription>ما يجب أن يعرفه المالك عن الصندوق دون فتح طرفية.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="تحديث"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            <ArrowClockwiseIcon className={health.isFetching ? "animate-spin" : undefined} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!data ? (
          <p className="text-sm text-muted-foreground">
            {health.isError ? "تعذّر قراءة حالة الخادم." : "جارٍ القراءة…"}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="قاعدة البيانات" value={formatBytes(data.database.bytes)} />
              <Stat
                label="الوسائط"
                value={`${formatBytes(data.media.bytes)} · ${data.media.assets.toLocaleString("ar")} ملف`}
              />
              <Stat
                label="الترحيلات المطبّقة"
                value={data.database.migration ? String(data.database.migration.applied) : "؟"}
                detail={
                  data.database.migration?.latestAt
                    ? ago(data.database.migration.latestAt)
                    : undefined
                }
              />
              <Stat
                label="تشغيل الواجهة منذ"
                value={uptime(data.api.uptimeSeconds)}
                detail={`Node ${data.api.node}`}
              />
              <Stat label="آخر فحص بيانات" value={ago(data.maintenance.lastValidate)} />
              <Stat label="آخر فحص وسائط" value={ago(data.maintenance.lastInspect)} />
            </dl>
            <div className="flex flex-wrap gap-2">
              <Integration ok={data.integrations.streamAddon} label="مصدر البث" />
              <Integration ok={data.integrations.openSubtitles} label="OpenSubtitles" />
              <Integration ok={data.integrations.tmdb} label="TMDB" />
              <Integration ok={data.integrations.fanart} label="Fanart" />
              {data.media.deletionFailures > 0 && (
                <Badge variant="destructive">{data.media.deletionFailures} فشل حذف ملفات</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              مجلد الوسائط:{" "}
              <code dir="ltr" className="font-mono">
                {data.api.mediaRoot}
              </code>
              {data.database.lastAdminAction
                ? ` · آخر عملية إدارية ${ago(data.database.lastAdminAction)} (${dateTime.format(new Date(data.database.lastAdminAction))})`
                : ""}
              {" · "}
              <Link to="/admin/archive" className="text-primary hover:underline">
                الصيانة
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
      {detail && <dd className="text-[11px] text-muted-foreground">{detail}</dd>}
    </div>
  );
}

function Integration({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "secondary" : "outline"} className="gap-1">
      {ok ? (
        <CheckCircleIcon className="text-primary" />
      ) : (
        <XCircleIcon className="text-muted-foreground" />
      )}
      {label}
      {ok ? "" : " — غير مضبوط"}
    </Badge>
  );
}
