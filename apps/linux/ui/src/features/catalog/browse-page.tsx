import type { CatalogEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCardNavigation, useLoadMoreNavigation } from "../../components/card-navigation";
import { MediaCard, ScoreBadge } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Drawer, DrawerTrigger } from "../../components/ui/drawer";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import { useIsAdmin } from "../account/use-is-admin";
import { replaceParams, workLink } from "../shell/navigation";
import { AppliedFilters } from "./applied-filters";
import {
  groupKey,
  groupTitle,
  parseGroup,
  parseSort,
  refinementCount,
  refinementQuery,
  withPreset,
} from "./browse-refinements";
import type { BrowseRefinements } from "./browse-refinements";
import { DisplaySettings, displayDefaults } from "./display-settings";
import { FilterDrawer } from "./filter-drawer";
import { parseFilters, optionLabel } from "./filter-model";
import { OrganizationControls } from "./organization-controls";
export function BrowsePage({
  params,
  path = "/browse",
  title = "تصفّح المكتبة",
  preset,
}: {
  params: URLSearchParams;
  path?: string;
  title?: string;
  preset?: { key: string; value: string };
}) {
  const navigation = useCardNavigation();

  const loadMore = useLoadMoreNavigation();
  const filters = withPreset(parseFilters(params.get("filters")), preset);
  const view = params.get("view") === "installments" ? "installments" : "works";
  const isAdmin = useIsAdmin();
  const privacy = !isAdmin
    ? "public"
    : params.get("privacy") === "all"
      ? "all"
      : params.get("privacy") === "private"
        ? "private"
        : "public";
  const sort = parseSort(params.get("sort"));
  const q = params.get("q") || "";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersMounted, setFiltersMounted] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const [display, setDisplay] = useState(displayDefaults);
  const { layout, size } = display;
  const group = parseGroup(params.get("group"));
  const refinements: BrowseRefinements = {
    filters,
    privacy,
    sort,
    group,
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
  const update = (values: Array<[string, string]>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of values) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    replaceParams(path, next);
  };
  const apply = (value: BrowseRefinements) =>
    update([
      ["filters", JSON.stringify(withPreset(value.filters, preset))],
      ["privacy", value.privacy === "public" ? "" : value.privacy],
      ["from", value.from],
      ["to", value.to],
      ["sort", value.sort === "year-desc" ? "" : value.sort],
      ["group", value.group === "none" ? "" : value.group],
    ]);
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const query = refinementQuery(refinements, view, debounced);
  const result = useInfiniteQuery({
    queryKey: ["catalog", "browse", query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.browse({ ...query, page: pageParam, pageSize: 30 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  const options = useQuery({
    queryKey: ["catalog", "facets", view, privacy],
    queryFn: ({ signal }) => gateway.facets({ view, privacy }, signal),
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const groups = new Map<string, CatalogEntry[]>();
  for (const item of items) {
    const key = groupKey(group, item);
    const entries = groups.get(key) ?? [];
    entries.push(item);
    groups.set(key, entries);
  }
  const totals = new Map(
    (result.data?.pages[0]?.groups ?? []).map((item) => [item.key, item.count]),
  );
  const groupOrder = result.data?.pages[0]?.groups?.map((item) => item.key) ?? [...groups.keys()];
  const groupedEntries = groupOrder.flatMap((key) => {
    const entries = groups.get(key);
    return entries ? [{ key, entries }] : [];
  });
  const lastGroup = groupedEntries.at(-1);
  const moreLabel =
    group !== "none" && lastGroup
      ? lastGroup.entries.length < (totals.get(lastGroup.key) ?? lastGroup.entries.length)
        ? `تحميل المزيد من ${groupTitle(group, lastGroup.key)}`
        : "تحميل المجموعة التالية"
      : "تحميل المزيد";

  return (
    <Drawer
      swipeDirection="right"
      open={filtersOpen}
      onOpenChange={(open) => {
        if (open) setFiltersMounted(true);
        setFiltersOpen(open);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setFiltersMounted(false);
      }}
    >
      <section
        className="mx-auto max-w-400 px-10 py-8 max-[720px]:px-5 max-[720px]:py-6"
        aria-label={title}
      >
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-relaxed font-semibold">{title}</h1>
            <Badge variant="secondary" aria-live="polite">
              {result.data?.pages[0]?.total ?? "…"} {view === "works" ? "عمل" : "موسم وإصدار"}
            </Badge>
          </div>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[view]}
            onValueChange={(values) => {
              if (values[0] === "works" || values[0] === "installments")
                update([["view", values[0]]]);
            }}
            aria-label="مستوى عرض الكتالوج"
          >
            <ToggleGroupItem value="works">الأعمال</ToggleGroupItem>
            <ToggleGroupItem value="installments">المواسم والإصدارات</ToggleGroupItem>
          </ToggleGroup>
        </header>
        <div className="mb-5 flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex min-w-0 items-center gap-3">
            <InputGroup className="h-10 min-w-0 flex-1">
              <InputGroupInput
                aria-label="البحث في المكتبة"
                value={q}
                placeholder="ابحث بعنوان، اسم بديل، صانع أو استوديو…"
                onChange={(event) => update([["q", event.target.value]])}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              {q && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-sm"
                    aria-label="مسح البحث"
                    onClick={() => update([["q", ""]])}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <DrawerTrigger
              render={
                <Button
                  ref={filterTrigger}
                  variant={refinementCount(refinements, preset) > 0 ? "secondary" : "outline"}
                  className="h-10"
                />
              }
            >
              <SlidersHorizontal data-icon="inline-start" />
              المرشحات
              {refinementCount(refinements, preset) > 0 && (
                <Badge variant="secondary">{refinementCount(refinements, preset)}</Badge>
              )}
            </DrawerTrigger>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-3">
            <OrganizationControls
              sort={sort}
              group={group}
              onSort={(next) => apply({ ...refinements, sort: next })}
              onGroup={(next) => apply({ ...refinements, group: next })}
            />
            <DisplaySettings value={display} onChange={setDisplay} />
          </div>
        </div>
        <AppliedFilters
          value={refinements}
          options={options.data}
          locked={preset}
          onChange={apply}
        />
        {group !== "none" && (
          <p className="mb-4 text-sm text-muted-foreground">
            تُحمّل المجموعات بالترتيب، ويُطبّق ترتيب الأعمال داخل كل مجموعة.
          </p>
        )}
        {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        {result.isLoading && <p role="status">جارٍ تحميل الكتالوج…</p>}
        {items.length === 0 && !result.isLoading && !result.error && <NoResults />}
        {groupedEntries.map(({ key, entries }) => (
          <section key={key}>
            {key !== "all" && (
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{groupTitle(group, key)}</h2>
                  <Badge variant="secondary">{totals.get(key) ?? entries.length}</Badge>
                </div>
                {totals.has(key) && entries.length < totals.get(key)! && (
                  <p className="text-xs text-muted-foreground">
                    {entries.length} من {totals.get(key)} محمّلة
                  </p>
                )}
              </header>
            )}
            {layout === "table" ? (
              <div className="my-6.5 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-start text-[13px]">
                  <thead>
                    <tr>
                      <th className="border-b border-border px-4.5 py-3.75 text-start font-normal text-muted-foreground">
                        العمل
                      </th>
                      <th className="border-b border-border px-4.5 py-3.75 text-start font-normal text-muted-foreground">
                        الإصدار
                      </th>
                      <th className="border-b border-border px-4.5 py-3.75 text-start font-normal text-muted-foreground">
                        التقييم
                      </th>
                      <th className="border-b border-border px-4.5 py-3.75 text-start font-normal text-muted-foreground">
                        الجمهور
                      </th>
                      <th className="border-b border-border px-4.5 py-3.75 text-start font-normal text-muted-foreground">
                        المشاهدة
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((item) => (
                      <tr key={item.installment?.id ?? item.work.id}>
                        <td className="border-b border-border px-4.5 py-3.75 text-start">
                          <a
                            {...navigation}
                            className="font-semibold"
                            href={workLink(item.work.id, item.installment?.id)}
                          >
                            {item.work.titleAr || item.work.canonicalTitle}
                          </a>
                        </td>
                        <td className="border-b border-border px-4.5 py-3.75 text-start">
                          {item.installment?.title ?? item.work.releaseYear}
                        </td>
                        <td className="border-b border-border px-4.5 py-3.75 text-start">
                          {item.status === "announced" &&
                          (item.installment?.score ?? item.work.score).rating === null ? (
                            "—"
                          ) : (
                            <ScoreBadge score={item.installment?.score ?? item.work.score} />
                          )}
                        </td>
                        <td className="border-b border-border px-4.5 py-3.75 text-start">
                          {optionLabel(item.classification.audience, item.classification.audience)}
                        </td>
                        <td className="border-b border-border px-4.5 py-3.75 text-start">
                          {optionLabel(item.watchState, item.watchState)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className={cn(
                  "grid",
                  layout === "banner"
                    ? cn(
                        "max-[900px]:grid-cols-3 max-[600px]:grid-cols-2 max-[450px]:grid-cols-1",
                        size === "compact"
                          ? "grid-cols-5"
                          : size === "comfortable"
                            ? "grid-cols-3"
                            : "grid-cols-4",
                      )
                    : cn(
                        "max-[1100px]:grid-cols-5 max-[800px]:grid-cols-4 max-[600px]:grid-cols-3 max-[450px]:grid-cols-2",
                        size === "compact"
                          ? "grid-cols-7"
                          : size === "comfortable"
                            ? "grid-cols-5"
                            : "grid-cols-6",
                      ),
                  "my-7 gap-x-5 gap-y-7 max-[600px]:gap-x-3 max-[600px]:gap-y-5",
                )}
              >
                {entries.map((item) => (
                  <MediaCard
                    key={item.installment?.id ?? item.work.id}
                    entry={item}
                    layout={layout}
                    minimal={display.minimal}
                    borderless={display.borderless}
                    showScore={display.showScore}
                    showStatus={display.showStatus}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
        {result.hasNextPage && (
          <Button
            {...navigation}
            className="mx-auto mt-8 flex"
            variant="outline"
            aria-disabled={result.isFetchingNextPage}
            onClick={(event) => {
              if (result.isFetchingNextPage) return;
              if (loadMore)
                void loadMore(event.currentTarget, async () => {
                  await result.fetchNextPage();
                });
              else void result.fetchNextPage();
            }}
          >
            {result.isFetchingNextPage ? "جارٍ التحميل…" : moreLabel}
          </Button>
        )}
        {filtersMounted && (
          <FilterDrawer
            value={refinements}
            view={view}
            q={q}
            locked={preset}
            returnFocus={filterTrigger}
            onApply={(value) => {
              apply(value);
              setFiltersOpen(false);
            }}
          />
        )}
      </section>
    </Drawer>
  );
}
