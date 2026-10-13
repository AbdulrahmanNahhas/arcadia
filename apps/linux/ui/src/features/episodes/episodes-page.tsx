import { useInfiniteQuery } from "@tanstack/react-query";
import { CalendarDays, LoaderCircle, Search, X } from "lucide-react";
import { useDeferredValue } from "react";

import { useLoadMoreNavigation } from "../../components/card-navigation";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { InputGroup, InputGroupInput, InputGroupAddon } from "../../components/ui/input-group";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import type { EpisodesQuery } from "../../lib/bridge";
import { gateway } from "../../lib/bridge";
import { useIsAdmin } from "../account/use-is-admin";
import { ViewingCard } from "../home/viewing-card";
import { replaceParams } from "../shell/navigation";

export function EpisodesPage({ params }: { params: URLSearchParams }) {
  const admin = useIsAdmin();
  const requestedWatchState = params.get("watchState");
  const watchState: "all" | "watched" | "unwatched" =
    requestedWatchState === "watched" || requestedWatchState === "unwatched"
      ? requestedWatchState
      : "all";
  const includePrivate = admin && params.get("includePrivate") === "true";
  const search = params.get("q") ?? "";
  const q = useDeferredValue(search.trim());
  const filters: EpisodesQuery = {};
  if (watchState !== "all") filters.watchState = watchState;
  if (includePrivate) filters.includePrivate = true;
  if (q) filters.q = q;
  const hasFilters = watchState !== "all" || includePrivate || Boolean(search);
  const update = (key: "watchState" | "includePrivate" | "q", value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all" || value === "false" || value === "") next.delete(key);
    else next.set(key, value);
    replaceParams("/episodes", next);
  };
  const loadMore = useLoadMoreNavigation();
  const result = useInfiniteQuery({
    queryKey: ["catalog", "episodes", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.episodes({ ...filters, page: pageParam, pageSize: 36 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const total = result.data?.pages[0]?.total;
  const fetchMore = async () => {
    await result.fetchNextPage();
  };

  return (
    <div className="mx-auto max-w-[1700px] space-y-8 px-4 py-8 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">الحلقات</h1>
            {total !== undefined && <Badge variant="secondary">{total} إصدار</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">أحدث الحلقات والأفلام الصادرة في مكتبتك</p>
        </div>
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href="#/releases">
          <CalendarDays data-icon="inline-start" />
          تقويم الإصدارات
        </a>
      </header>
      <div className="flex flex-wrap items-center gap-3" aria-label="تصفية الحلقات والأفلام">
        <div className="min-w-48 flex-1">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="البحث باسم العمل أو الحلقة أو الفيلم"
              placeholder="اسم العمل أو الحلقة أو الفيلم…"
              value={search}
              maxLength={200}
              onChange={(event) => update("q", event.target.value)}
            />
          </InputGroup>
        </div>
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[watchState]}
          aria-label="حالة مشاهدة الحلقات والأفلام"
          onValueChange={(values) => {
            if (values[0] === "all" || values[0] === "watched" || values[0] === "unwatched")
              update("watchState", values[0]);
          }}
        >
          <ToggleGroupItem value="all">الكل</ToggleGroupItem>
          <ToggleGroupItem value="unwatched">غير مُشاهد</ToggleGroupItem>
          <ToggleGroupItem value="watched">مُشاهد</ToggleGroupItem>
        </ToggleGroup>
        {admin && (
          <Field orientation="horizontal" className="w-auto">
            <Switch
              id="episodes-private"
              size="sm"
              checked={includePrivate}
              onCheckedChange={(checked) => update("includePrivate", String(checked))}
            />
            <FieldLabel htmlFor="episodes-private">تضمين المخفية</FieldLabel>
          </Field>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="مسح تصفية الحلقات والأفلام"
            title="مسح التصفية"
            onClick={() => replaceParams("/episodes", new URLSearchParams())}
          >
            <X />
          </Button>
        )}
      </div>
      {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
      <div
        className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        aria-label="الحلقات والأفلام"
      >
        {items.map((item) => (
          <ViewingCard
            key={item.episodeId ?? item.installmentId}
            item={item}
            poster={!item.episodeId}
          />
        ))}
        {(result.isLoading || result.isFetchingNextPage) &&
          Array.from({ length: result.isLoading ? 8 : 4 }, (_, index) => (
            <div key={index} className="space-y-3" role="status" aria-label="جارٍ تحميل الإصدارات">
              <Skeleton className="aspect-video rounded-2xl" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
      </div>
      {total === 0 && (
        <NoResults
          title={hasFilters ? "لا توجد إصدارات مطابقة" : "لا توجد حلقات أو أفلام صادرة بعد"}
          description={
            hasFilters
              ? "غيّر البحث أو حالة المشاهدة لتوسيع النتائج."
              : "تظهر هنا الحلقات والأفلام التي لها تاريخ إصدار مسجّل حتى اليوم."
          }
        />
      )}
      {result.hasNextPage && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {items.length} من {total} إصدار
          </p>
          <Button
            variant="outline"
            disabled={result.isFetchingNextPage}
            onClick={(event) => {
              if (loadMore) void loadMore(event.currentTarget, fetchMore);
              else void fetchMore();
            }}
          >
            {result.isFetchingNextPage && (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            )}
            {result.isFetchingNextPage ? "جارٍ تحميل الإصدارات…" : "عرض المزيد"}
          </Button>
        </div>
      )}
    </div>
  );
}
