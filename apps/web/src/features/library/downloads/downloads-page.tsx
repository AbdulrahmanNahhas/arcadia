import {
  ArrowSquareOutIcon,
  DownloadSimpleIcon,
  FolderOpenIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { cn } from "@/lib/utils";
import { useIsDesktopShell } from "../play-button";
import { formatBytes } from "../player/format";
import {
  type DownloadItem,
  desktopDownloads,
  downloadStateLabel,
  formatRate,
  openFolder,
  pickDownloadDir,
  revealDownload,
  useDownloads,
} from "./api";
import { readDeviceName, writeDeviceName } from "./mirror";

/**
 * `/downloads` — every video this device keeps on disk, with the exact path of each file. The
 * whole page is the Rust registry rendered live (`useDownloads`); nothing here reads the server.
 */
export function DownloadsPage() {
  const desktop = useIsDesktopShell();
  const { dir, items } = useDownloads();
  const [dirError, setDirError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState(() => (desktop ? readDeviceName() : ""));

  const sorted = items.toSorted((a, b) => b.createdAtMs - a.createdAtMs);
  const usedBytes = items.reduce((sum, item) => sum + item.downloadedBytes, 0);
  const activeCount = items.filter((item) => item.state === "downloading").length;

  const changeDir = async () => {
    setDirError(null);
    try {
      const chosen = await pickDownloadDir(dir);
      if (chosen) await desktopDownloads.setDir(chosen);
    } catch (cause) {
      setDirError(cause instanceof Error ? cause.message : "تعذّر تغيير المجلد.");
    }
  };

  return (
    <PlatformShell>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              التنزيلات
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              الأفلام والحلقات المحفوظة كملفات على هذا الجهاز. تُشغَّل من القرص مباشرة دون شبكة، وتُحفظ
              الترجمات العربية والإنجليزية بجانب كل ملف عند توفرها.
            </p>
          </div>
          {desktop && (
            <dl className="flex gap-6 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">المساحة المستخدمة</dt>
                <dd className="font-mono">{formatBytes(usedBytes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">قيد التنزيل</dt>
                <dd className="font-mono">{activeCount}</dd>
              </div>
            </dl>
          )}
        </div>

        {!desktop ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <DownloadSimpleIcon />
              </EmptyMedia>
              <EmptyTitle>متاح في تطبيق سطح المكتب</EmptyTitle>
              <EmptyDescription>
                التنزيل يحتاج قرصاً محلياً ومحرّك التورنت المدمج، وكلاهما جزء من تطبيق سطح المكتب فقط.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <section className="mb-6 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">مجلد التنزيلات</div>
                  <code
                    dir="ltr"
                    className="mt-1 block truncate font-mono text-sm text-foreground"
                    title={dir}
                  >
                    {dir || "…"}
                  </code>
                  {dirError && <p className="mt-1 text-xs text-destructive">{dirError}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!dir}
                    onClick={() => void openFolder(dir)}
                  >
                    <FolderOpenIcon data-icon="inline-start" /> فتح المجلد
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void changeDir()}>
                    تغيير المجلد
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                تغيير المجلد يؤثر على التنزيلات الجديدة فقط؛ الملفات الموجودة تبقى حيث هي. كل عمل
                يحصل على مجلد فرعي باسمه.
              </p>
              <label className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground">
                  اسم هذا الجهاز كما يراه أفراد العائلة
                </span>
                <Input
                  className="h-8 max-w-56"
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  onBlur={() => writeDeviceName(deviceName)}
                />
              </label>
            </section>

            {sorted.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <DownloadSimpleIcon />
                  </EmptyMedia>
                  <EmptyTitle>لا توجد تنزيلات بعد</EmptyTitle>
                  <EmptyDescription>
                    زر «تنزيل» بجانب أي فيلم أو حلقة في صفحة العمل يحفظه هنا.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {sorted.map((item) => (
                  <DownloadRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </PlatformShell>
  );
}

function DownloadRow({ item }: { item: DownloadItem }) {
  const [busy, setBusy] = useState(false);
  const percent =
    item.sizeBytes > 0
      ? Math.min(100, Math.round((item.downloadedBytes / item.sizeBytes) * 100))
      : 0;
  const done = item.state === "completed";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/titles/$titleId"
              params={{ titleId: item.titleId }}
              className="truncate font-heading text-base font-semibold hover:underline"
            >
              {item.titleName}
            </Link>
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <Badge
              variant={done ? "default" : item.state === "failed" ? "destructive" : "secondary"}
            >
              {downloadStateLabel(item.state)}
            </Badge>
          </div>
          <code
            dir="ltr"
            className="mt-2 block truncate font-mono text-xs text-muted-foreground"
            title={item.path ?? item.folder}
          >
            {item.path ?? `${item.folder}/…`}
          </code>
          {item.subtitles.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {item.subtitles.map((subtitle) => (
                <code key={subtitle.language} dir="ltr" className="font-mono">
                  {subtitle.path.split("/").at(-1)}
                </code>
              ))}
            </div>
          )}
          {item.error && (
            <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <WarningCircleIcon /> {item.error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {done && item.path && (
            <>
              <Link
                to="/player/$installmentId"
                params={{ installmentId: item.installmentId }}
                search={{ titleId: item.titleId, episodeId: item.episodeId, origin: "/downloads" }}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <PlayIcon weight="fill" /> تشغيل
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="إظهار الملف"
                title="إظهار الملف في مدير الملفات"
                onClick={() => void revealDownload(item.path ?? item.folder)}
              >
                <ArrowSquareOutIcon />
              </Button>
            </>
          )}
          {item.state === "downloading" || item.state === "queued" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="إيقاف مؤقت"
              disabled={busy}
              onClick={() => void run(() => desktopDownloads.pause(item.id))}
            >
              <PauseIcon />
            </Button>
          ) : null}
          {item.state === "paused" || item.state === "failed" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="استئناف"
              disabled={busy}
              onClick={() => void run(() => desktopDownloads.resume(item.id))}
            >
              <PlayIcon />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="إزالة وحذف الملف"
            title="إزالة وحذف الملف من القرص"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`حذف «${item.titleName} — ${item.label}» من القرص؟`)) {
                void run(() => desktopDownloads.remove(item.id, true));
              }
            }}
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
      {!done && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full bg-primary transition-[width]",
                item.state === "paused" && "opacity-50",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            <span className="font-mono">{percent}٪</span>
            <span className="font-mono">
              {formatBytes(item.downloadedBytes)} /{" "}
              {item.sizeBytes ? formatBytes(item.sizeBytes) : "؟"}
            </span>
            {item.state === "downloading" && (
              <>
                <span className="font-mono">{formatRate(item.downloadRateBps)}</span>
                <span>{item.peersConnected} نظير</span>
              </>
            )}
          </div>
        </div>
      )}
      {done && (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-mono">{formatBytes(item.sizeBytes)}</span>
        </div>
      )}
    </li>
  );
}
