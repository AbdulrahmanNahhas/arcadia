import { WifiHighIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared date formatters — one instance per shape, reused across every panel in `/archive`. */
export const dateFormat = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
export const dateTimeFormat = new Intl.DateTimeFormat("ar", {
  dateStyle: "medium",
  timeStyle: "short",
});
export const timeFormat = new Intl.DateTimeFormat("ar", { timeStyle: "short" });
export const monthFormat = new Intl.DateTimeFormat("ar", { month: "short" });
export const dayFormat = new Intl.DateTimeFormat("ar", { day: "numeric" });
export const monthYearFormat = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" });

/** Fixed at module load — "is this upcoming?" filters throughout `/archive` compare against the
 *  moment the session started, not `Date.now()` at render, so a release that ticks into the past
 *  mid-session doesn't pop out of a list the user is actively looking at. */
export const sessionStartedAt = Date.now();

/** Whole-percent watched, or `null` when the runtime is unknown (a stream that never reported a
 *  duration) — callers show "بدأته" rather than a bar that would have to guess. */
export function watchPercent(positionSeconds: number, durationSeconds: number | null) {
  if (!durationSeconds || durationSeconds <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((positionSeconds / durationSeconds) * 100)));
}

function arabicMinutes(total: number) {
  if (total === 1) return "دقيقة واحدة";
  if (total === 2) return "دقيقتان";
  if (total <= 10) return `${total} دقائق`;
  return `${total} دقيقة`;
}

function arabicHours(total: number) {
  if (total === 1) return "ساعة";
  if (total === 2) return "ساعتان";
  if (total <= 10) return `${total} ساعات`;
  return `${total} ساعة`;
}

/**
 * "يتبقى ساعة و12 دقيقة" — the number a resume surface actually needs, in the prefix form
 * (`يتبقى` + counted noun) that stays grammatical for every count, unlike a trailing adjective
 * that would have to agree with singular/dual/plural. Returns `null` when the runtime is unknown.
 */
export function remainingLabel(positionSeconds: number, durationSeconds: number | null) {
  if (!durationSeconds || durationSeconds <= 0) return null;
  const remaining = Math.max(0, durationSeconds - positionSeconds);
  if (remaining < 60) return "أوشك على الانتهاء";
  const minutes = Math.round(remaining / 60);
  if (minutes < 60) return `يتبقى ${arabicMinutes(minutes)}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `يتبقى ${arabicHours(hours)}`
    : `يتبقى ${arabicHours(hours)} و${arabicMinutes(rest)}`;
}

export const installmentKindLabel = {
  season: "موسم",
  movie: "فيلم",
  special: "خاص",
} satisfies Record<"season" | "movie" | "special", string>;

export function PanelTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Row-shaped skeleton — matches every list panel that isn't a poster grid: notifications, family
 * activity, recommendations, calendar/"coming next", and the watch/browsing history rows.
 * `leading` mirrors each row's own leading element so the placeholder reads as "the same shape",
 * not just "some shape": a status dot (notifications), an avatar circle (activity/recommendations),
 * or a small poster thumbnail (history).
 */
export function ListSkeleton({
  rows = 3,
  leading = "avatar",
  label = "جارٍ التحميل",
}: {
  rows?: number;
  leading?: "avatar" | "thumbnail" | "dot";
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="divide-y overflow-hidden rounded-2xl border bg-card"
    >
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-count placeholder list, never reordered or filtered
        <div key={index} className="flex items-center gap-4 p-4">
          {leading === "dot" ? (
            <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
          ) : leading === "thumbnail" ? (
            <Skeleton className="aspect-2/3 w-12 shrink-0 rounded-xl" />
          ) : (
            <Skeleton className="size-10 shrink-0 rounded-full" />
          )}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Failed({ retry }: { retry: () => void }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WifiHighIcon />
        </EmptyMedia>
        <EmptyTitle>تعذّر تحميل هذا القسم</EmptyTitle>
        <EmptyDescription>
          بقيت بقية مساحتك متاحة. تحقق من اتصال الخادم ثم حاول مرة أخرى.
        </EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" onClick={retry}>
        إعادة المحاولة
      </Button>
    </Empty>
  );
}

export function Blank({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
