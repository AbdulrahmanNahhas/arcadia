import {
  BookmarkSimpleIcon,
  BooksIcon,
  HeartIcon,
  PlayIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { syncTitleOfflineCache } from "@/features/library/saved-offline";
import { updateTitleState } from "@/features/social/api";
import { RatingStars } from "@/features/social/rating-stars";
import { cn } from "@/lib/utils";
import { archiveKeys, getLibrary, type LibraryEntry } from "../api";
import { Blank, Failed, PanelTitle } from "./shared";

/** Placeholder in the poster-grid's own shape and column count, so the real grid doesn't reflow
 *  the page when it arrives — the generic list-shaped skeleton used to jump noticeably here. */
function LibraryGridSkeleton() {
  return (
    <div
      role="status"
      aria-label="جارٍ ترتيب مكتبتك"
      className="grid grid-cols-3 gap-x-4 gap-y-6 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
    >
      {Array.from({ length: 14 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-count placeholder, never reordered
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-2/3 w-full rounded-2xl" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/**
 * One "My Space" library entry: full poster art with every affordance — favorite, offline save,
 * personal rating, removal — living in a hover/focus overlay over the art itself, the way a
 * streaming "My List" tile works, instead of a permanent footer row competing with the poster for
 * space. The poster stays the whole card; nothing here shrinks it.
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
    <div className="group/card relative">
      <div
        className={cn(
          "relative aspect-2/3 overflow-hidden rounded-2xl bg-muted",
          "ring-1 ring-border/70",
          "transition-[box-shadow,ring-color,transform] duration-300",
          "group-hover/card:-translate-y-1 group-hover/card:scale-[1.02] group-hover/card:shadow-xl group-hover/card:shadow-foreground/15",
          "group-focus-within/card:ring-2 group-focus-within/card:ring-ring",
          "group-focus-within/card:shadow-xl group-focus-within/card:shadow-foreground/20",
          "motion-reduce:transition-none motion-reduce:transform-none",
        )}
      >
        <Link
          to="/titles/$titleId"
          params={{ titleId: item.titleId }}
          className="absolute inset-0 outline-none"
        >
          {item.posterPath ? (
            <img
              src={item.posterPath}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover",
                "transition-transform duration-500",
                "group-hover/card:scale-[1.045]",
                "motion-reduce:transition-none",
              )}
            />
          ) : null}
          <div
            data-on-artwork
            className={cn(
              "absolute inset-0 bg-linear-to-t from-background/90 via-background/15 to-transparent",
              "opacity-0 transition-opacity duration-200 motion-reduce:transition-none",
              "group-hover/card:opacity-100 group-focus-within/card:opacity-100",
            )}
          />
        </Link>
        {item.positionSeconds && progress !== null ? (
          <div
            data-on-artwork
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-background/50"
          >
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {item.savedOffline ? (
          <span
            data-on-artwork
            className="pointer-events-none absolute top-2 inset-s-2 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground ring-1 ring-border/70 backdrop-blur-md"
          >
            <BookmarkSimpleIcon weight="fill" className="size-3.5" />
          </span>
        ) : null}
        {/* Sibling of the poster `Link`, not a descendant — the rating stars are real buttons of
         *  their own, and nesting them inside the anchor would fire a navigation on every click. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-between gap-1 px-2 pb-2 opacity-0 transition-all duration-200 motion-reduce:transition-none group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100">
          {progress !== null ? (
            <span
              data-on-artwork
              className="flex items-center gap-1 text-[0.6875rem] font-medium text-foreground"
            >
              <PlayIcon weight="fill" className="size-3" />
              {progress}٪
            </span>
          ) : (
            <span />
          )}
          <RatingStars
            size="sm"
            value={item.personalRating}
            disabled={mutation.isPending}
            onRate={(next) => mutation.mutate({ personalRating: next })}
            className="pointer-events-auto"
          />
        </div>
      </div>
      <Link
        to="/titles/$titleId"
        params={{ titleId: item.titleId }}
        className="mt-2 block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h3 className="line-clamp-1 text-sm font-medium hover:text-primary">{item.title}</h3>
      </Link>
      <div className="absolute inset-e-1.5 top-1.5 flex flex-col gap-1 opacity-0 transition-opacity duration-200 motion-reduce:transition-none group-hover/card:opacity-100 group-focus-within/card:opacity-100">
        <button
          type="button"
          aria-label={item.isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
          aria-pressed={item.isFavorite}
          disabled={mutation.isPending}
          onClick={(event) => {
            event.preventDefault();
            mutation.mutate({ isFavorite: !item.isFavorite });
          }}
          data-on-artwork
          className={cn(
            "flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground ring-1 ring-border/70 backdrop-blur-md transition hover:bg-accent hover:text-accent-foreground",
            item.isFavorite && "text-primary",
          )}
        >
          <HeartIcon weight={item.isFavorite ? "fill" : "regular"} className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={item.savedOffline ? "إزالة الحفظ دون اتصال" : "حفظ دون اتصال"}
          aria-pressed={item.savedOffline}
          disabled={mutation.isPending}
          onClick={(event) => {
            event.preventDefault();
            mutation.mutate({ savedOffline: !item.savedOffline });
          }}
          data-on-artwork
          className={cn(
            "flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground ring-1 ring-border/70 backdrop-blur-md transition hover:bg-accent hover:text-accent-foreground",
            item.savedOffline && "text-primary",
          )}
        >
          <BookmarkSimpleIcon
            weight={item.savedOffline ? "fill" : "regular"}
            className="size-3.5"
          />
        </button>
        <button
          type="button"
          aria-label="إزالة من مكتبتي"
          disabled={mutation.isPending}
          onClick={(event) => {
            event.preventDefault();
            mutation.mutate({
              isFavorite: false,
              personalRating: null,
              notes: "",
              savedOffline: false,
            });
          }}
          data-on-artwork
          className="flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground ring-1 ring-border/70 backdrop-blur-md transition hover:bg-destructive hover:text-destructive-foreground"
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>
    </div>
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
  if (query.isLoading) return <LibraryGridSkeleton />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const items = query.data ?? [];
  const activeFilter = isLibraryFilter(filter) ? filter : "all";
  const activeSort = isLibrarySort(sort) ? sort : "updated";
  const buckets = {
    all: items,
    saved: items.filter((item) => item.savedOffline),
    favorites: items.filter((item) => item.isFavorite),
    rated: items.filter((item) => item.personalRating !== null),
  } satisfies Record<LibraryFilter, LibraryEntry[]>;
  const filtered = buckets[activeFilter];
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PanelTitle
          title="مكتبتي"
          description="المحفوظات والمفضلة والتقييمات. الحفظ هنا يحتفظ ببيانات العمل وصوره، وليس ملف الفيديو."
        />
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[activeFilter]}
            multiple={false}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="تصفية المكتبة"
            onValueChange={(values) => {
              const next = values[0];
              if (next && isLibraryFilter(next)) onFilterChange(next);
            }}
          >
            {libraryFilters.map(([value, label]) => (
              <ToggleGroupItem key={value} value={value} className="gap-1.5">
                {label}
                <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                  {buckets[value].length}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
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
