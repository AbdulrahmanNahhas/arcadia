import type { TitleDetail } from "@arcadia/contracts";
import { ArrowRightIcon, DownloadSimpleIcon, StarIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { kindLabelsAr } from "@/features/library/translations";
import { titleToWork } from "@/server/compat";
import { listOfflineTitles } from "./offline-store";

/**
 * The unauthenticated fallback library (`/offline`, linked from the login form) — for a device
 * with no reachable family server and no session to speak of, listing exactly what
 * `saveTitleOffline` (`offline-store.ts`) already cached on *this* device: metadata and artwork,
 * never the video itself. Deliberately reads straight from IndexedDB rather than through
 * `lib/api.ts`/TanStack Query — there is nothing to authenticate against here.
 */
export function OfflineLibraryPage() {
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [titles, setTitles] = useState<TitleDetail[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await listOfflineTitles();
      if (cancelled) return;
      setTitles(result);
      setState("ready");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="platform-surface min-h-svh px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-amber-500">
              <WifiSlashIcon size={15} weight="fill" />
              <span>وضع العرض دون اتصال</span>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              الأعمال المحفوظة على هذا الجهاز
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              هذه الأعمال التي حفظتها للعرض دون اتصال قبل انقطاع الشبكة عن خادم العائلة. المعروض هو
              الملصقات والبيانات والوصف؛ أما الفيديو فيُشغَّل دون شبكة فقط إن كان قد نُزِّل مسبقاً من صفحة
              التنزيلات.
            </p>
          </div>

          <Link
            to="/login"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowRightIcon size={15} />
            العودة إلى تسجيل الدخول
          </Link>
        </div>

        {state === "loading" && (
          <p className="py-16 text-center text-sm text-muted-foreground" aria-live="polite">
            جارٍ فتح المحفوظات المحلية…
          </p>
        )}

        {state === "ready" && titles.length === 0 && (
          <Empty className="rounded-3xl border bg-card/60">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <DownloadSimpleIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد أعمال محفوظة بعد</EmptyTitle>
              <EmptyDescription>
                عندما يتوفر اتصال بخادم العائلة، افتح أي عمل واختر "احفظ للمشاهدة دون اتصال" حتى
                يظهر هنا لاحقاً.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {state === "ready" && titles.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {titles.map((detail) => (
              <OfflineTitleCard key={detail.id} detail={detail} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function OfflineTitleCard({ detail }: { detail: TitleDetail }) {
  const work = titleToWork(detail);
  const displayTitle = work.arabicTitle || work.title;

  return (
    <Link
      to="/offline/$titleId"
      params={{ titleId: work.id }}
      className="group block min-w-0 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-foreground/10 transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-[1.02]">
        {work.imagePath ? (
          <img
            src={work.imagePath}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-end bg-linear-to-br from-primary/25 via-muted to-muted p-3">
            <span className="font-heading text-sm leading-6 text-foreground/90">
              {displayTitle}
            </span>
          </div>
        )}

        {work.calculatedRating !== null && (
          <Badge className="absolute inset-e-2 top-2 font-semibold">
            <StarIcon weight="fill" className="size-3 text-amber-300" />
            {work.calculatedRating.toFixed(1)}
          </Badge>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate font-heading text-sm font-semibold text-foreground group-hover:text-primary">
          {displayTitle}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {work.year ?? "—"} · {kindLabelsAr[work.kind]}
        </p>
      </div>
    </Link>
  );
}
