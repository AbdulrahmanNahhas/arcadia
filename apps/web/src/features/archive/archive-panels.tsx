import type { ContinueWatchingItem, FamilyActivity, ReleaseCalendarItem } from "@arcadia/contracts";
import {
  BellIcon,
  BookmarkSimpleIcon,
  BooksIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  CloudArrowDownIcon,
  HeartIcon,
  PlayCircleIcon,
  StarIcon,
  TrashIcon,
  UsersThreeIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import {
  type PlayerEvent,
  subscribeToPlayer,
  type TransferProgress,
} from "@/features/library/desktop-player";
import { useIsDesktopShell } from "@/features/library/play-button";
import { syncTitleOfflineCache } from "@/features/library/saved-offline";
import { toggleReaction, updateTitleState } from "@/features/social/api";
import { RatingStars } from "@/features/social/rating-stars";
import { cn } from "@/lib/utils";
import {
  archiveKeys,
  clearHistory,
  clearWatchHistory,
  getCalendar,
  getContinueWatching,
  getFamilyActivity,
  getFamilyEvents,
  getHistory,
  getLibrary,
  getNotifications,
  getRecommendations,
  getWatchHistory,
  getWatchStats,
  type LibraryEntry,
  readNotification,
  respondRecommendation,
  toggleFollow,
  voteForEventTitle,
} from "./api";

const dateFormat = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });
const monthFormat = new Intl.DateTimeFormat("ar", { month: "short" });
const dayFormat = new Intl.DateTimeFormat("ar", { day: "numeric" });
const monthYearFormat = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" });
const sessionStartedAt = Date.now();

const installmentKindLabel = {
  season: "موسم",
  movie: "فيلم",
  special: "خاص",
} satisfies Record<"season" | "movie" | "special", string>;

function PanelTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-muted-foreground">{description}</p>
    </div>
  );
}

/** Poster-card shaped skeleton — matches the library/favorites/saved grids' own row shape
 *  (poster + title + meta + action row), so data arriving doesn't reflow the page around it. */
function GridSkeleton() {
  return (
    <div
      role="status"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="جارٍ ترتيب الأرشيف"
    >
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex gap-4 rounded-2xl border bg-card p-3">
          <Skeleton className="aspect-2/3 w-20 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-3 py-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="mt-auto h-8 w-full" />
          </div>
        </div>
      ))}
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
function ListSkeleton({
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

function Failed({ retry }: { retry: () => void }) {
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

function Blank({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
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

function QuickStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/55 p-5">
      <strong className="font-mono text-2xl">{value}</strong>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * One "My Space" library entry: poster + title link to the title page, and a footer row of real
 * affordances — favorite toggle, editable star rating, and full removal — sitting *outside* the
 * link so none of them trigger navigation. Every card here is guaranteed non-empty (the API
 * already filters out rows with no favorite/rating/notes), so "remove" always has something to
 * remove.
 */
function LibraryCard({ item }: { item: LibraryEntry }) {
  const client = useQueryClient();
  const progress =
    item.durationSeconds && item.positionSeconds
      ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
      : null;
  const mutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateTitleState>[1]) => {
      if (input.savedOffline !== undefined) {
        await syncTitleOfflineCache(item.titleId, input.savedOffline);
      }
      return updateTitleState(item.titleId, input);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.library }),
  });
  return (
    <Card className="overflow-hidden p-0">
      <Link
        to="/titles/$titleId"
        params={{ titleId: item.titleId }}
        className="group flex gap-4 p-3"
      >
        <div className="aspect-2/3 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {item.posterPath ? (
            <img src={item.posterPath} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 py-1">
          <h3 className="line-clamp-2 font-heading font-semibold group-hover:text-primary">
            {item.title}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            حُدّثت {dateFormat.format(new Date(item.updatedAt))}
          </p>
          {item.savedOffline ? (
            <Badge variant="secondary" className="mt-3 gap-1">
              <BookmarkSimpleIcon weight="fill" />
              محفوظ دون اتصال
            </Badge>
          ) : null}
          {item.positionSeconds ? (
            <div className="mt-3">
              {progress === null ? (
                <p className="text-xs text-muted-foreground">بدأت المشاهدة</p>
              ) : (
                <>
                  <Progress value={progress} aria-label={`تقدّم المشاهدة ${progress}٪`} />
                  <p className="mt-1 text-xs text-muted-foreground">{progress}٪ مُشاهَد</p>
                </>
              )}
            </div>
          ) : null}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={item.savedOffline ? "إزالة الحفظ دون اتصال" : "حفظ دون اتصال"}
            aria-pressed={item.savedOffline}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ savedOffline: !item.savedOffline })}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition",
              item.savedOffline ? "text-primary" : "text-muted-foreground hover:text-primary",
            )}
          >
            <BookmarkSimpleIcon weight={item.savedOffline ? "fill" : "regular"} />
          </button>
          <button
            type="button"
            aria-label={item.isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
            aria-pressed={item.isFavorite}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ isFavorite: !item.isFavorite })}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition",
              item.isFavorite ? "text-primary" : "text-muted-foreground hover:text-primary",
            )}
          >
            <HeartIcon weight={item.isFavorite ? "fill" : "regular"} />
          </button>
          <RatingStars
            value={item.personalRating}
            disabled={mutation.isPending}
            onRate={(next) => mutation.mutate({ personalRating: next })}
          />
        </div>
        <button
          type="button"
          aria-label="إزالة من مكتبتي"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              isFavorite: false,
              personalRating: null,
              notes: "",
              savedOffline: false,
            })
          }
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon />
        </button>
      </div>
    </Card>
  );
}

const libraryFilters = [
  ["all", "الكل"],
  ["saved", "المحفوظات"],
  ["favorites", "المفضلة"],
  ["rated", "تقييماتي"],
] as const;
type LibraryFilter = (typeof libraryFilters)[number][0];

const librarySorts = [
  { value: "updated", label: "آخر تحديث" },
  { value: "played", label: "آخر تشغيل" },
  { value: "title", label: "العنوان" },
  { value: "release", label: "تاريخ الإصدار" },
  { value: "rating", label: "تقييمي" },
  { value: "progress", label: "التقدم" },
] as const;
export type LibrarySort = (typeof librarySorts)[number]["value"];

function isLibraryFilter(value: string): value is LibraryFilter {
  return libraryFilters.some(([option]) => option === value);
}

export function isLibrarySort(value: string): value is LibrarySort {
  return librarySorts.some((option) => option.value === value);
}

export function LibraryPanel({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: {
  filter: string;
  sort: string;
  onFilterChange: (filter: LibraryFilter) => void;
  onSortChange: (sort: LibrarySort) => void;
}) {
  const query = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary });
  if (query.isLoading) return <GridSkeleton />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const items = query.data ?? [];
  const activeFilter = isLibraryFilter(filter) ? filter : "all";
  const activeSort = isLibrarySort(sort) ? sort : "updated";
  const filtered =
    activeFilter === "saved"
      ? items.filter((item) => item.savedOffline)
      : activeFilter === "favorites"
        ? items.filter((item) => item.isFavorite)
        : activeFilter === "rated"
          ? items.filter((item) => item.personalRating !== null)
          : items;
  const sorted = filtered.toSorted((a, b) => {
    if (activeSort === "title") return a.title.localeCompare(b.title, "ar");
    if (activeSort === "rating") return (b.personalRating ?? 0) - (a.personalRating ?? 0);
    if (activeSort === "played")
      return String(b.lastPlayedAt).localeCompare(String(a.lastPlayedAt));
    if (activeSort === "release") return String(b.releaseDate).localeCompare(String(a.releaseDate));
    if (activeSort === "progress") {
      const left = a.durationSeconds ? (a.positionSeconds ?? 0) / a.durationSeconds : 0;
      const right = b.durationSeconds ? (b.positionSeconds ?? 0) / b.durationSeconds : 0;
      return right - left;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PanelTitle
          title="مكتبتي"
          description="المحفوظات والمفضلة والتقييمات. الحفظ هنا يحتفظ ببيانات العمل وصوره، وليس ملف الفيديو."
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border bg-card p-1">
            {libraryFilters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={activeFilter === value}
                onClick={() => onFilterChange(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition",
                  activeFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Select
            items={librarySorts}
            value={activeSort}
            onValueChange={(value) => {
              if (value) onSortChange(value);
            }}
          >
            <SelectTrigger className="w-36" aria-label="ترتيب المكتبة">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {librarySorts.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      {sorted.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item) => (
            <LibraryCard key={item.titleId} item={item} />
          ))}
        </div>
      ) : (
        <Blank icon={<BooksIcon />} title={items.length ? "لا نتائج لهذا الفلتر" : "مكتبتك جاهزة"}>
          {items.length
            ? "جرّب فلترًا آخر من الأعلى."
            : "احفظ عملاً أو أضفه إلى المفضلة أو قيّمه من صفحته."}
        </Blank>
      )}
    </>
  );
}

/** Horizontal poster row — favorites restyled off the old badge+list layout, per Phase D. */
function FavoritesShelf() {
  const query = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary });
  if (query.isLoading) return <GridSkeleton />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const favorites = (query.data ?? []).filter((item) => item.isFavorite);
  if (!favorites.length) {
    return (
      <Blank icon={<HeartIcon />} title="لا مفضلة بعد">
        أضف عملاً إلى المفضلة من صفحته ليظهر هنا.
      </Blank>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {favorites.map((item) => (
        <Link
          key={item.titleId}
          to="/titles/$titleId"
          params={{ titleId: item.titleId }}
          className="group w-30 shrink-0"
        >
          <div className="aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-transparent transition group-hover:ring-primary/50">
            {item.posterPath ? (
              <img src={item.posterPath} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <p className="mt-2 line-clamp-1 text-sm font-medium group-hover:text-primary">
            {item.title}
          </p>
        </Link>
      ))}
    </div>
  );
}

function SavedShelf() {
  const query = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary });
  if (query.isLoading) return <GridSkeleton />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const saved = (query.data ?? []).filter((item) => item.savedOffline);
  if (!saved.length) {
    return (
      <Blank icon={<CloudArrowDownIcon />} title="لا محفوظات بعد">
        احفظ بيانات عمل وصوره لتبقى متاحة على هذا الجهاز عند انقطاع الخادم.
      </Blank>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto p-2">
      {saved.slice(0, 8).map((item) => (
        <Link
          key={item.titleId}
          to="/titles/$titleId"
          params={{ titleId: item.titleId }}
          className="group flex w-48 shrink-0 items-center gap-3 rounded-xl border bg-background/35 p-2"
        >
          <div className="aspect-2/3 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
            {item.posterPath ? (
              <img src={item.posterPath} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <span className="min-w-0">
            <strong className="line-clamp-2 text-sm group-hover:text-primary">{item.title}</strong>
            <span className="mt-1 block text-[11px] text-muted-foreground">متاح دون اتصال</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function RecommendationsPreview() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: archiveKeys.recommendations,
    queryFn: getRecommendations,
  });
  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "deferred" | "dismissed" }) =>
      respondRecommendation(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.recommendations }),
  });
  if (query.isLoading) return <ListSkeleton leading="avatar" />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const pending = (query.data ?? []).filter((item) => item.status === "pending").slice(0, 3);
  if (!pending.length) {
    return (
      <Blank icon={<UsersThreeIcon />} title="لا توصيات جديدة">
        عندما يرشّح لك أحد أفراد العائلة عملاً سيظهر هنا مع السبب.
      </Blank>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {pending.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-xl border bg-background/35">
          <Link
            to="/titles/$titleId"
            params={{ titleId: item.title.id }}
            className="flex items-center gap-3 p-3 hover:bg-muted/35"
          >
            <AccountAvatar
              avatarKey={item.sender.avatarKey}
              label={item.sender.displayName}
              className="size-10"
            />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{item.title.title}</strong>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {item.sender.displayName}: {item.reason}
              </span>
              <time
                dateTime={item.createdAt}
                className="mt-1 block text-[10px] text-muted-foreground"
              >
                أُرسلت {dateFormat.format(new Date(item.createdAt))}
              </time>
            </span>
          </Link>
          <div className="flex items-center gap-1 border-t p-1.5">
            <Button
              size="sm"
              variant="ghost"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: item.id, status: "accepted" })}
            >
              قبول
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: item.id, status: "deferred" })}
            >
              لاحقًا
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto text-muted-foreground"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: item.id, status: "dismissed" })}
            >
              تجاهل
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComingNextPreview() {
  const calendar = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar });
  const events = useQuery({ queryKey: archiveKeys.events, queryFn: getFamilyEvents });
  const notifications = useQuery({
    queryKey: archiveKeys.notifications,
    queryFn: getNotifications,
  });
  if (calendar.isLoading && events.isLoading && notifications.isLoading) {
    return <ListSkeleton leading="avatar" />;
  }
  if (calendar.isError && events.isError && notifications.isError) {
    return (
      <Failed
        retry={() => {
          void calendar.refetch();
          void events.refetch();
          void notifications.refetch();
        }}
      />
    );
  }
  const upcoming = (calendar.data ?? [])
    .filter((item) => new Date(item.releaseDate).getTime() >= sessionStartedAt)
    .toSorted((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    .slice(0, 4);
  const nextEvent = (events.data ?? [])
    .filter(
      (item) => item.scheduledFor && new Date(item.scheduledFor).getTime() >= sessionStartedAt,
    )
    .toSorted((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)))
    .at(0);
  const unreadCount = (notifications.data ?? []).filter((item) => item.readAt === null).length;
  if (!upcoming.length && !nextEvent && unreadCount === 0) {
    return (
      <Blank icon={<CalendarBlankIcon />} title="لا مواعيد قريبة">
        تابع عملاً أو خطط لسهرة عائلية لتظهر الخطوة القادمة هنا.
      </Blank>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {nextEvent ? (
        <Link
          to="/archive"
          search={{ tab: "family" }}
          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UsersThreeIcon />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm">{nextEvent.name}</strong>
            <span className="block truncate text-xs text-muted-foreground">
              سهرة عائلية ·{" "}
              {dateTimeFormat.format(new Date(nextEvent.scheduledFor ?? sessionStartedAt))}
            </span>
          </span>
        </Link>
      ) : null}
      {unreadCount > 0 ? (
        <Link
          to="/archive"
          search={{ tab: "notifications" }}
          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellIcon />
          </span>
          <span>
            <strong className="block text-sm">{unreadCount} تنبيهات غير مقروءة</strong>
            <span className="text-xs text-muted-foreground">افتح مركز التنبيهات</span>
          </span>
        </Link>
      ) : null}
      {upcoming.map((item) => (
        <Link
          key={item.installmentId}
          to="/titles/$titleId"
          params={{ titleId: item.titleId }}
          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
        >
          <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
            <strong className="text-sm">{new Date(item.releaseDate).getDate()}</strong>
            <span className="text-[9px]">{monthFormat.format(new Date(item.releaseDate))}</span>
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm">{item.title}</strong>
            <span className="block truncate text-xs text-muted-foreground">
              {item.installmentTitle}
            </span>
          </span>
        </Link>
      ))}
      {upcoming.length ? (
        <Link
          to="/archive"
          search={{ tab: "calendar" }}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          فتح التقويم كاملًا
        </Link>
      ) : null}
    </div>
  );
}

function ContinueWatchingCard({
  item,
  showProgress,
}: {
  item: ContinueWatchingItem;
  showProgress: boolean;
}) {
  const origin = useLocation({ select: (location) => location.href });
  const percent =
    showProgress && item.durationSeconds
      ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
      : null;
  return (
    <Link
      to="/player/$installmentId"
      params={{ installmentId: item.installmentId }}
      search={{ titleId: item.titleId, episodeId: item.episodeId, origin }}
      className="group w-36 shrink-0 rounded-md! focus:px-1! focus:py-1!"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted">
        {item.posterPath ? (
          <img
            src={item.posterPath}
            alt=""
            className="size-full object-cover transition group-hover:scale-105"
          />
        ) : null}
        {percent !== null ? (
          <Progress
            value={percent}
            aria-label={`شاهدت ${percent}%`}
            className="absolute inset-x-0 bottom-0 h-1.5 rounded-none bg-black/40"
          />
        ) : null}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium group-hover:text-primary">{item.title}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">
        {item.episodeLabel ?? item.installmentTitle}
      </p>
    </Link>
  );
}

/** "أكمل المشاهدة / التالي في المتابعات" — driven by Phase B's `account_playback_states`. */
function ContinueWatchingRow() {
  const query = useQuery({ queryKey: archiveKeys.continueWatching, queryFn: getContinueWatching });
  if (query.isLoading) return <GridSkeleton />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const inProgress = query.data?.inProgress ?? [];
  const upNext = query.data?.upNext ?? [];
  if (!inProgress.length && !upNext.length) {
    return (
      <Blank icon={<PlayCircleIcon />} title="لا شيء قيد المتابعة">
        ابدأ مشاهدة عمل، أو تابع أعمالاً من صفحاتها لتظهر هنا بطاقات المتابعة والتالي.
      </Blank>
    );
  }
  return (
    <div className="space-y-5">
      {inProgress.length ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">أكمل المشاهدة</h3>
          <div className="flex gap-3 overflow-x-auto p-2">
            {inProgress.map((item) => (
              <ContinueWatchingCard
                key={`${item.installmentId}:${item.episodeId ?? "movie"}`}
                item={item}
                showProgress
              />
            ))}
          </div>
        </div>
      ) : null}
      {upNext.length ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">التالي في المتابعات</h3>
          <div className="flex gap-3 overflow-x-auto p-2">
            {upNext.map((item) => (
              <ContinueWatchingCard
                key={`${item.installmentId}:${item.episodeId ?? "movie"}`}
                item={item}
                showProgress={false}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 ميغابايت";
  const units = ["بايت", "كيلوبايت", "ميغابايت", "غيغابايت"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * Desktop-only "active downloads" card. Subscribes to the same `subscribeToPlayer` channel the
 * player route uses — no new Tauri command needed, since `AppState` already exposes exactly one
 * transfer-progress pump. Leaving the player route stops the torrent on purpose (see
 * `player-page.tsx`), so this honestly shows an idle state whenever nothing is actively streaming
 * rather than fabricating cross-route "background download" data the current architecture doesn't
 * have — it lights up automatically the moment a stream starts elsewhere in the app.
 */
function ActiveTransferWidget() {
  const desktop = useIsDesktopShell();
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    const onEvent = (event: PlayerEvent) => {
      if (cancelled) return;
      if (event.type === "transfer") setTransfer(event);
      else if (event.type === "idle" || event.type === "ended") setTransfer(null);
    };
    subscribeToPlayer(onEvent).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [desktop]);
  if (!desktop) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudArrowDownIcon className="text-primary" /> التنزيلات النشطة
        </CardTitle>
        <CardDescription>سرعة النقل والنظراء أثناء تشغيل عمل من التطبيق.</CardDescription>
      </CardHeader>
      <CardContent>
        {transfer ? (
          <div className="space-y-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${transfer.totalBytes ? Math.min(100, (transfer.downloadedBytes / transfer.totalBytes) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2 font-mono text-xs text-muted-foreground">
              <span>
                {formatBytes(transfer.downloadedBytes)}
                {transfer.totalBytes ? ` / ${formatBytes(transfer.totalBytes)}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <WifiHighIcon /> {formatBytes(transfer.downloadRateBps)}/ث ·{" "}
                {transfer.peersConnected} نظير
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            لا يوجد تنزيل نشط الآن — تظهر السرعة والنظراء هنا فور بدء تشغيل عمل من مساحتك.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const reactionGlyphs = {
  heart: "❤️",
  clap: "👏",
  laugh: "😂",
  wow: "😮",
  think: "🤔",
} satisfies Record<string, string>;

/** `item.reactions` is keyed by whatever emoji the server aggregated, so an unknown key (a future
 * reaction kind not in `reactionGlyphs`) is expected, not a bug — fall back to the raw emoji name. */
function glyphForReaction(emoji: string): string {
  // SAFETY: `Object.hasOwn` just confirmed `emoji` names one of `reactionGlyphs`' own literal
  // keys, so the index below is guaranteed to resolve to a string, never `undefined`.
  return Object.hasOwn(reactionGlyphs, emoji)
    ? reactionGlyphs[emoji as keyof typeof reactionGlyphs]
    : emoji;
}

function isReactableKind(kind: FamilyActivity["kind"]): kind is "review" | "comment" {
  return kind !== "favorite";
}

/**
 * AniList-style family feed: ratings, reviews, comments, and reactions, newest first. Built
 * standalone and decoupled from any one panel — `variant="sidebar"` is a tighter read used in the
 * Overview tab; `variant="panel"` is the full-width read used in the Family tab. Both mount the
 * same component and query, matching the roadmap's "reusable as a sidebar" requirement scoped to
 * `/archive`'s own panels for v1 (see the doc's Open Questions table).
 */
export function FamilyActivityFeed({
  variant = "panel",
  limit,
}: {
  variant?: "panel" | "sidebar";
  limit?: number;
}) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.activity, queryFn: getFamilyActivity });
  const react = useMutation({
    mutationFn: ({ kind, id }: { kind: "review" | "comment"; id: string }) =>
      toggleReaction(kind, id, "heart"),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.activity }),
  });
  if (query.isLoading) return <ListSkeleton leading="avatar" />;
  const items = query.data ?? [];
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) {
    return (
      <Blank icon={<UsersThreeIcon />} title="لا نشاط عائلي بعد">
        تقييمات وتعليقات ومفضلات العائلة تظهر هنا فور حدوثها.
      </Blank>
    );
  }
  return (
    <div className="space-y-3">
      {shown.map((item) => {
        const reactableKind = isReactableKind(item.kind) ? item.kind : null;
        return (
          <div
            key={item.id}
            className={cn("rounded-2xl border bg-card", variant === "sidebar" ? "p-3" : "p-4")}
          >
            <div className="flex gap-3">
              <AccountAvatar
                avatarKey={item.account.avatarKey}
                label={item.account.displayName}
                className={variant === "sidebar" ? "size-8" : "size-10"}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <strong>{item.account.displayName}</strong>{" "}
                  {item.kind === "review"
                    ? "كتب مراجعة عن"
                    : item.kind === "comment"
                      ? "علّق على"
                      : "أضاف إلى المفضلة"}{" "}
                  <Link
                    to="/titles/$titleId"
                    params={{ titleId: item.title.id }}
                    className="text-primary"
                  >
                    {item.title.name}
                  </Link>
                </p>
                {item.rating !== null ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <StarIcon weight="fill" className="text-primary" /> {item.rating} / 5
                  </p>
                ) : null}
                {item.body ? (
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{item.body}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {dateTimeFormat.format(new Date(item.createdAt))}
                  </p>
                  {reactableKind ? (
                    <div className="flex items-center gap-1">
                      {Object.entries(item.reactions)
                        .filter(([, count]) => count > 0)
                        .map(([emoji, count]) => (
                          <span
                            key={emoji}
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[11px]"
                          >
                            {glyphForReaction(emoji)} {count}
                          </span>
                        ))}
                      <button
                        type="button"
                        aria-label="فاعل بإعجاب"
                        disabled={react.isPending}
                        onClick={() => react.mutate({ kind: reactableKind, id: item.id })}
                        className="rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-primary"
                      >
                        + ❤️
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ArchiveOverview() {
  const stats = useQuery({ queryKey: archiveKeys.watchStats, queryFn: getWatchStats }).data;
  const calendar = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar }).data ?? [];
  const library = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary }).data ?? [];
  const upcoming = calendar.filter((item) => new Date(item.releaseDate) >= new Date()).length;
  const cards = [
    [
      "قيد المتابعة",
      stats?.inProgressCount ?? 0,
      ClockCounterClockwiseIcon,
      "أعمال بدأتها ولم تُكملها",
    ],
    ["شوهدت هذا الشهر", stats?.watchedThisMonth ?? 0, CheckCircleIcon, "حلقات وأفلام مكتملة"],
    [
      "ساعات المشاهدة",
      stats ? Number(stats.totalHoursWatched.toFixed(1)) : 0,
      ClockIcon,
      "إجمالي الوقت المسجَّل",
    ],
    ["إصدارات قادمة", upcoming, CalendarBlankIcon, "أفلام ومواسم مؤرَّخة"],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.55fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>أكمل المشاهدة</CardTitle>
              <CardDescription>عد مباشرة إلى الحلقة أو الفيلم من حيث توقفت.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContinueWatchingRow />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>محفوظ دون اتصال</CardTitle>
              <CardDescription>بيانات وصور احتفظت بها على هذا الجهاز.</CardDescription>
            </CardHeader>
            <CardContent>
              <SavedShelf />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>من العائلة</CardTitle>
              <CardDescription>توصيات وصلت إليك مع سبب الاختيار.</CardDescription>
            </CardHeader>
            <CardContent>
              <RecommendationsPreview />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>القادم</CardTitle>
              <CardDescription>أقرب الإصدارات للأعمال التي تتابعها.</CardDescription>
            </CardHeader>
            <CardContent>
              <ComingNextPreview />
            </CardContent>
          </Card>
          <ActiveTransferWidget />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>المفضلة</CardTitle>
          <CardDescription>الأعمال التي وضعت عليها علامة القلب.</CardDescription>
        </CardHeader>
        <CardContent>
          <FavoritesShelf />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>نبض مساحتك</CardTitle>
          <CardDescription>تقييماتك ومتابعاتك منفصلة عن التقييم التحريري.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, Icon, detail]) => (
            <div key={label} className="rounded-2xl bg-muted/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <CardDescription>{label}</CardDescription>
                <Icon className="text-primary" />
              </div>
              <strong className="mt-2 block font-mono text-2xl">{value}</strong>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </div>
          ))}
          <QuickStat
            label="مقيَّمة شخصيًا"
            value={library.filter((item) => item.personalRating !== null).length}
          />
          <QuickStat label="في المفضلة" value={library.filter((item) => item.isFavorite).length} />
          <QuickStat
            label="إصدارات أتابعها"
            value={calendar.filter((item) => item.followed).length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function HistoryPanel() {
  const client = useQueryClient();
  const origin = useLocation({ select: (location) => location.href });
  const browsing = useQuery({ queryKey: archiveKeys.history, queryFn: getHistory });
  const watching = useQuery({ queryKey: archiveKeys.watchHistory, queryFn: getWatchHistory });
  const clear = useMutation({
    mutationFn: () => clearHistory(),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.history }),
  });
  const clearWatching = useMutation({
    mutationFn: ({
      installmentId,
      episodeId,
    }: {
      installmentId?: string;
      episodeId?: string | null;
    }) => clearWatchHistory(installmentId, episodeId),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.watchHistory }),
  });
  if (browsing.isLoading && watching.isLoading)
    return <ListSkeleton leading="thumbnail" rows={4} />;
  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <PanelTitle
            title="سجل المشاهدة"
            description="الأفلام والحلقات التي شغّلتها، مع آخر موضع محفوظ لكل منها."
          />
          {watching.data?.length ? (
            <Button
              variant="outline"
              onClick={() => clearWatching.mutate({})}
              disabled={clearWatching.isPending}
            >
              <TrashIcon /> مسح سجل المشاهدة
            </Button>
          ) : null}
        </div>
        {watching.isLoading ? (
          <ListSkeleton leading="thumbnail" />
        ) : watching.isError ? (
          <Failed retry={() => void watching.refetch()} />
        ) : watching.data?.length ? (
          <div className="divide-y rounded-2xl border bg-card">
            {watching.data.map((item) => {
              const percent = item.durationSeconds
                ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
                : null;
              return (
                <div
                  key={`${item.installmentId}:${item.episodeId ?? "movie"}`}
                  className="flex items-center hover:bg-muted/35"
                >
                  <Link
                    to="/player/$installmentId"
                    params={{ installmentId: item.installmentId }}
                    search={{ titleId: item.titleId, episodeId: item.episodeId, origin }}
                    className="flex min-w-0 flex-1 items-center gap-4 p-4"
                  >
                    <div className="aspect-2/3 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {item.posterPath ? (
                        <img src={item.posterPath} alt="" className="size-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate">{item.title}</strong>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.episodeLabel ?? item.installmentTitle} ·{" "}
                        {dateTimeFormat.format(new Date(item.playedAt ?? item.updatedAt))}
                      </p>
                      {percent !== null && !item.isPlayed ? (
                        <Progress
                          value={percent}
                          aria-label={`شاهدت ${percent}%`}
                          className="mt-2 h-1.5"
                        />
                      ) : null}
                    </div>
                    <Badge variant={item.isPlayed ? "secondary" : "outline"}>
                      {item.isPlayed ? "تمّت مشاهدته" : percent === null ? "بدأته" : `${percent}%`}
                    </Badge>
                  </Link>
                  <button
                    type="button"
                    aria-label={`حذف ${item.episodeLabel ?? item.title} من سجل المشاهدة`}
                    disabled={clearWatching.isPending}
                    onClick={() =>
                      clearWatching.mutate({
                        installmentId: item.installmentId,
                        episodeId: item.episodeId,
                      })
                    }
                    className="me-3 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <TrashIcon />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <Blank icon={<PlayCircleIcon />} title="لم تبدأ المشاهدة بعد">
            شغّل فيلماً أو حلقة وسيظهر تقدمك هنا تلقائياً.
          </Blank>
        )}
      </section>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <PanelTitle
            title="سجل التصفح"
            description="صفحات الأعمال التي فتحتها؛ هذا منفصل عن سجل المشاهدة."
          />
          {browsing.data?.length ? (
            <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>
              <TrashIcon /> مسح السجل
            </Button>
          ) : null}
        </div>
        {browsing.isLoading ? (
          <ListSkeleton leading="thumbnail" />
        ) : browsing.isError ? (
          <Failed retry={() => void browsing.refetch()} />
        ) : browsing.data?.length ? (
          <div className="divide-y rounded-2xl border bg-card">
            {browsing.data.map((item) => (
              <Link
                key={item.title.id}
                to="/titles/$titleId"
                params={{ titleId: item.title.id }}
                className="flex items-center gap-4 p-4 hover:bg-muted/35"
              >
                <div className="size-12 overflow-hidden rounded-xl bg-muted">
                  {item.title.posterPath ? (
                    <img src={item.title.posterPath} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <strong>{item.title.title}</strong>
                  <p className="text-xs text-muted-foreground">
                    {dateTimeFormat.format(new Date(item.viewedAt))}
                  </p>
                </div>
                <Badge variant="outline">{item.visitCount} زيارة</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <Blank icon={<ClockCounterClockwiseIcon />} title="لا يوجد سجل بعد">
            ستظهر هنا الأعمال التي تزورها لاحقاً.
          </Blank>
        )}
      </section>
    </div>
  );
}

/** `releaseDate`-ordered items grouped into `"YYYY-MM"` buckets, insertion order preserved — the
 *  server already returns rows ordered by date, so a `Map` keeps every group chronological with
 *  no extra sort. */
function groupReleasesByMonth(items: ReleaseCalendarItem[]) {
  const groups = new Map<string, ReleaseCalendarItem[]>();
  for (const item of items) {
    const key = item.releaseDate.slice(0, 7);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries());
}

function CalendarSkeleton() {
  return (
    <div
      role="status"
      aria-label="جارٍ تحميل التقويم"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="flex flex-col gap-2.5">
          <Skeleton className="aspect-2/3 w-full rounded-2xl" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** One dated release: poster-forward like every other catalog card, with the release day/month
 *  and installment kind overlaid on the artwork instead of a separate text row, and the follow
 *  toggle as the one real action underneath. */
function CalendarReleaseCard({
  item,
  onToggleFollow,
  pending,
}: {
  item: ReleaseCalendarItem;
  onToggleFollow: () => void;
  pending: boolean;
}) {
  const date = new Date(item.releaseDate);
  return (
    <div className="group flex flex-col gap-2.5">
      <Link
        to="/titles/$titleId"
        params={{ titleId: item.titleId }}
        className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-white/10 transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-[1.02] motion-reduce:transition-none">
          {item.posterPath ? (
            <img
              src={item.posterPath}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-br from-primary/25 via-muted to-muted p-3">
              <span className="font-heading text-sm leading-6 text-foreground/90">
                {item.title}
              </span>
            </div>
          )}
          <div className="absolute start-2 top-2 flex flex-col items-center justify-center rounded-xl bg-black/70 px-2 py-1 leading-none text-white ring-1 ring-white/15">
            <strong className="text-sm">{dayFormat.format(date)}</strong>
            <span className="mt-0.5 text-[10px]">{monthFormat.format(date)}</span>
          </div>
          <Badge variant="secondary" className="absolute end-2 top-2">
            {installmentKindLabel[item.kind]}
          </Badge>
        </div>
      </Link>

      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.installmentTitle}</p>
      </div>

      <Button
        size="sm"
        variant={item.followed ? "secondary" : "outline"}
        disabled={pending}
        onClick={onToggleFollow}
      >
        {item.followed ? <CheckCircleIcon /> : <BellIcon />}
        {item.followed ? "تتابعه" : "تابع العمل"}
      </Button>
    </div>
  );
}

export function CalendarPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar });
  const follow = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.calendar }),
  });
  return (
    <>
      <PanelTitle
        title="تقويم الإصدارات"
        description="كل الأفلام والمواسم المؤرَّخة القادمة، بلا سقف زمني تعسفي — بدءًا من الشهر الماضي."
      />
      {query.isLoading ? (
        <CalendarSkeleton />
      ) : query.isError ? (
        <Failed retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <div className="flex flex-col gap-8">
          {groupReleasesByMonth(query.data).map(([month, items]) => (
            <section key={month}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {monthYearFormat.format(new Date(items[0]?.releaseDate ?? month))}
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {items.map((item) => (
                  <CalendarReleaseCard
                    key={item.installmentId}
                    item={item}
                    pending={follow.isPending}
                    onToggleFollow={() => follow.mutate(item.titleId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Blank icon={<CalendarBlankIcon />} title="لا مواعيد قريبة">
          لا توجد أجزاء مؤرخة ضمن النافذة الحالية.
        </Blank>
      )}
    </>
  );
}

export function FamilyPanel() {
  const client = useQueryClient();
  const recommendations = useQuery({
    queryKey: archiveKeys.recommendations,
    queryFn: getRecommendations,
  });
  const events = useQuery({ queryKey: archiveKeys.events, queryFn: getFamilyEvents });
  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "deferred" | "dismissed" }) =>
      respondRecommendation(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.recommendations }),
  });
  const vote = useMutation({
    mutationFn: ({ eventId, titleId }: { eventId: string; titleId: string }) =>
      voteForEventTitle(eventId, titleId),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.events }),
  });
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section>
        <PanelTitle title="نشاط العائلة" description="ما اختار أفراد العائلة إظهاره داخل البيت." />
        <FamilyActivityFeed variant="panel" limit={20} />
      </section>
      <div className="space-y-6">
        <section>
          <PanelTitle
            title="التوصيات المباشرة"
            description="اقتراحات من شخص إلى شخص، مع قرار واضح."
          />
          <div className="space-y-3">
            {recommendations.data?.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <AccountAvatar
                      avatarKey={item.sender.avatarKey}
                      label={item.sender.displayName}
                      className="size-10"
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {item.sender.displayName} رشّح{" "}
                        <Link
                          to="/titles/$titleId"
                          params={{ titleId: item.title.id }}
                          className="text-primary"
                        >
                          {item.title.title}
                        </Link>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                    </div>
                  </div>
                  {item.status === "pending" ? (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respond.mutate({ id: item.id, status: "accepted" })}
                      >
                        سأشاهده
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respond.mutate({ id: item.id, status: "deferred" })}
                      >
                        لاحقاً
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => respond.mutate({ id: item.id, status: "dismissed" })}
                      >
                        تجاهل
                      </Button>
                    </div>
                  ) : (
                    <Badge className="mt-3" variant="secondary">
                      {item.status}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
            {!recommendations.isLoading && !recommendations.data?.length ? (
              <Blank icon={<UsersThreeIcon />} title="لا توصيات بعد">
                أرسل توصية من صفحة أي عمل.
              </Blank>
            ) : null}
          </div>
        </section>
        <section>
          <PanelTitle title="ليلة العائلة" description="مواعيد ومقترحات يجري حسمها بالتصويت." />
          <div className="space-y-3">
            {events.data?.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                  <CardDescription>
                    {event.scheduledFor
                      ? dateTimeFormat.format(new Date(event.scheduledFor))
                      : "الموعد قيد التخطيط"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {event.candidates.map((candidate) => (
                    <button
                      type="button"
                      key={candidate.title.id}
                      onClick={() =>
                        vote.mutate({ eventId: event.id, titleId: candidate.title.id })
                      }
                      className="flex w-full items-center justify-between rounded-xl border p-3 text-start hover:bg-muted/40"
                    >
                      <span>{candidate.title.title}</span>
                      <Badge variant={candidate.votedByMe ? "default" : "outline"}>
                        {candidate.votes} صوت
                      </Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
            {!events.isLoading && !events.data?.length ? (
              <Blank icon={<UsersThreeIcon />} title="لا توجد ليلة مخططة">
                يمكن إنشاء موعد جديد مع مقترحات للمشاهدة.
              </Blank>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function NotificationsPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.notifications, queryFn: getNotifications });
  const read = useMutation({
    mutationFn: readNotification,
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.notifications }),
  });
  return (
    <>
      <PanelTitle
        title="مركز التنبيهات"
        description="ردود وتفاعلات وتحديثات الأرشيف المهمة لحسابك."
      />
      {query.isLoading ? (
        <ListSkeleton leading="dot" />
      ) : query.data?.length ? (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {query.data.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => !item.readAt && read.mutate(item.id)}
              className="flex w-full gap-4 p-4 text-start hover:bg-muted/35"
            >
              <span
                className={`mt-2 size-2 shrink-0 rounded-full ${item.readAt ? "bg-muted" : "bg-primary"}`}
              />
              <div className="flex-1">
                <p className={item.readAt ? "text-muted-foreground" : "font-medium"}>
                  {item.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dateTimeFormat.format(new Date(item.createdAt))}
                </p>
              </div>
              {!item.readAt ? <Badge>جديد</Badge> : null}
            </button>
          ))}
        </div>
      ) : (
        <Blank icon={<BellIcon />} title="صندوق هادئ">
          لا توجد تنبيهات الآن.
        </Blank>
      )}
    </>
  );
}
