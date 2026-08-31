import type { ContinueWatchingItem, FamilyActivity } from "@arcadia/contracts";
import {
  BellIcon,
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
import { Link } from "@tanstack/react-router";
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
import { AccountAvatar } from "@/features/accounts/account-avatar";
import {
  type PlayerEvent,
  subscribeToPlayer,
  type TransferProgress,
} from "@/features/library/desktop-player";
import { useIsDesktopShell } from "@/features/library/play-button";
import { toggleReaction, updateTitleState } from "@/features/social/api";
import { cn } from "@/lib/utils";
import {
  archiveKeys,
  clearHistory,
  getCalendar,
  getContinueWatching,
  getFamilyActivity,
  getFamilyEvents,
  getHistory,
  getLibrary,
  getNotifications,
  getRecommendations,
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

function Loading() {
  return <p className="py-14 text-center text-muted-foreground">جارٍ ترتيب الأرشيف…</p>;
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

/** A clickable 1–5 star rating. Clicking the currently-set value clears it. */
function RatingStars({
  value,
  onRate,
  disabled,
}: {
  value: number | null;
  onRate: (next: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={`${n} من 5 نجوم`}
          disabled={disabled}
          onClick={() => onRate(value === n ? null : n)}
          className="rounded p-0.5 text-muted-foreground transition hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <StarIcon
            weight={value !== null && n <= value ? "fill" : "regular"}
            className={value !== null && n <= value ? "text-primary" : undefined}
          />
        </button>
      ))}
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
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTitleState>[1]) =>
      updateTitleState(item.titleId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.library }),
  });
  return (
    <Card className="overflow-hidden p-0">
      <Link
        to="/titles/$titleId"
        params={{ titleId: item.titleId }}
        className="group flex gap-4 p-3"
      >
        <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
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
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={item.isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
            aria-pressed={item.isFavorite}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ isFavorite: !item.isFavorite })}
            className={cn(
              "rounded-full p-1 transition",
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
          onClick={() => mutation.mutate({ isFavorite: false, personalRating: null, notes: "" })}
          className="rounded-full p-1 text-muted-foreground transition hover:text-destructive"
        >
          <TrashIcon />
        </button>
      </div>
    </Card>
  );
}

const libraryFilters = [
  ["all", "الكل"],
  ["favorites", "المفضلة"],
  ["rated", "تقييماتي"],
] as const;
type LibraryFilter = (typeof libraryFilters)[number][0];

export function LibraryPanel() {
  const query = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary });
  const [filter, setFilter] = useState<LibraryFilter>("all");
  if (query.isLoading) return <Loading />;
  const items = query.data ?? [];
  const filtered =
    filter === "favorites"
      ? items.filter((item) => item.isFavorite)
      : filter === "rated"
        ? items
            .filter((item) => item.personalRating !== null)
            .toSorted((a, b) => (b.personalRating ?? 0) - (a.personalRating ?? 0))
        : items;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PanelTitle
          title="مكتبتي"
          description="المفضلة والتقييمات الشخصية، قابلة للتعديل من البطاقة مباشرة."
        />
        <div className="flex gap-1 rounded-full border bg-card p-1">
          {libraryFilters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <LibraryCard key={item.titleId} item={item} />
          ))}
        </div>
      ) : (
        <Blank icon={<BooksIcon />} title={items.length ? "لا نتائج لهذا الفلتر" : "مكتبتك جاهزة"}>
          {items.length ? "جرّب فلترًا آخر من الأعلى." : "أضف مفضلة أو تقييمًا شخصيًا من أي صفحة عمل."}
        </Blank>
      )}
    </>
  );
}

/** Horizontal poster row — favorites restyled off the old badge+list layout, per Phase D. */
function FavoritesShelf() {
  const query = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary });
  if (query.isLoading) return <Loading />;
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
          <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted ring-1 ring-transparent transition group-hover:ring-primary/50">
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

function ContinueWatchingCard({
  item,
  showProgress,
}: {
  item: ContinueWatchingItem;
  showProgress: boolean;
}) {
  const percent =
    showProgress && item.durationSeconds
      ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
      : null;
  return (
    <Link
      to="/player/$installmentId"
      params={{ installmentId: item.installmentId }}
      search={{ titleId: item.titleId, episodeId: item.episodeId }}
      className="group w-36 shrink-0"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted">
        {item.posterPath ? (
          <img
            src={item.posterPath}
            alt=""
            className="size-full object-cover transition group-hover:scale-105"
          />
        ) : null}
        {percent !== null ? (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
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
  if (query.isLoading) return <Loading />;
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
          <div className="flex gap-3 overflow-x-auto pb-2">
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
          <div className="flex gap-3 overflow-x-auto pb-2">
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
  if (query.isLoading) return <Loading />;
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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, detail]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>{label}</CardDescription>
                <Icon className="text-primary" />
              </div>
              <CardTitle className="font-mono text-3xl">{value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>المتابعة</CardTitle>
              <CardDescription>
                استئناف ما بدأته، ومعرفة ما يليه في الأعمال التي تتابعها.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContinueWatchingRow />
            </CardContent>
          </Card>
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
              <CardTitle>نبض الأرشيف الشخصي</CardTitle>
              <CardDescription>
                ملخّص سريع يحافظ على الفصل بين تقييمك الشخصي والتقييم التحريري.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <QuickStat
                label="مقيَّمة شخصيًا"
                value={library.filter((item) => item.personalRating !== null).length}
              />
              <QuickStat
                label="في المفضلة"
                value={library.filter((item) => item.isFavorite).length}
              />
              <QuickStat
                label="إصدارات أتابعها"
                value={calendar.filter((item) => item.followed).length}
              />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <ActiveTransferWidget />
          <Card>
            <CardHeader>
              <CardTitle>نشاط العائلة</CardTitle>
              <CardDescription>آخر التفاعلات في مكان واحد.</CardDescription>
            </CardHeader>
            <CardContent>
              <FamilyActivityFeed variant="sidebar" limit={5} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function HistoryPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.history, queryFn: getHistory });
  const clear = useMutation({
    mutationFn: () => clearHistory(),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.history }),
  });
  if (query.isLoading) return <Loading />;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PanelTitle title="سجل التصفح" description="آخر الأعمال التي فتحتها، محفوظة لحسابك فقط." />
        {query.data?.length ? (
          <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>
            <TrashIcon /> مسح السجل
          </Button>
        ) : null}
      </div>
      {query.data?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {query.data.map((item) => (
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
    </>
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
        <Loading />
      ) : query.data?.length ? (
        <div className="space-y-3">
          {query.data.map((item) => (
            <Card key={item.installmentId}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex size-14 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <strong>{new Date(item.releaseDate).getDate()}</strong>
                  <span className="text-[10px]">
                    {monthFormat.format(new Date(item.releaseDate))}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/titles/$titleId"
                      params={{ titleId: item.titleId }}
                      className="font-heading font-semibold hover:text-primary"
                    >
                      {item.title}
                    </Link>
                    <Badge variant="secondary">{installmentKindLabel[item.kind]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.installmentTitle} · {dateFormat.format(new Date(item.releaseDate))}
                  </p>
                </div>
                <Button
                  variant={item.followed ? "secondary" : "outline"}
                  onClick={() => follow.mutate(item.titleId)}
                >
                  {item.followed ? <CheckCircleIcon /> : <BellIcon />}
                  {item.followed ? "تتابعه" : "تابع العمل"}
                </Button>
              </CardContent>
            </Card>
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
        <Loading />
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
