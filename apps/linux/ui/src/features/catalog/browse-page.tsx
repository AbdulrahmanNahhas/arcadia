import type { CatalogEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCardNavigation, useLoadMoreNavigation } from "../../components/card-navigation";
import { MediaCard, ScoreBadge } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Button } from "../../components/ui/button";
import { InputGroup, InputGroupInput } from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import { replaceParams, workLink } from "../shell/navigation";
import { AppliedFilters } from "./applied-filters";
import {
  groupLabel,
  parseGroup,
  parseSort,
  refinementCount,
  refinementQuery,
  withPreset,
} from "./browse-refinements";
import type { BrowseRefinements } from "./browse-refinements";
import { DisplaySettings, displayDefaults } from "./display-settings";
import { FilterDialog } from "./filter-dialog";
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
  const privacy =
    params.get("privacy") === "all"
      ? "all"
      : params.get("privacy") === "private"
        ? "private"
        : "public";
  const sort = parseSort(params.get("sort"));
  const q = params.get("q") || "";
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    const key = groupLabel(group, item);
    const entries = groups.get(key) ?? [];
    entries.push(item);
    groups.set(key, entries);
  }

  return (
    <section className="mx-auto max-w-[1600px] px-[clamp(20px,4vw,64px)] py-10" aria-label={title}>
      <header className="mb-8 flex items-center justify-between gap-6 max-[750px]:flex-col max-[750px]:items-start max-[750px]:gap-3.5">
        <div>
          <p className="mb-1.25 text-[13px] leading-[1.8] text-muted-foreground">
            كل الحكايات، من مكان واحد
          </p>
          <h1 className="text-[clamp(28px,3vw,42px)] leading-[1.7] font-bold">{title}</h1>
        </div>
        <p className="text-[13px] leading-[1.8] text-muted-foreground">
          {result.data?.pages[0].total ?? "…"} {view === "works" ? "عمل" : "موسم وإصدار"}
        </p>
      </header>
      <div className="mb-5.5 flex flex-wrap items-center gap-3">
        <InputGroup className="min-w-0 flex-1 max-[750px]:basis-full">
          <InputGroupInput
            aria-label="البحث في المكتبة"
            value={q}
            placeholder="عنوان، موسم، اسم بديل، استوديو أو صانع…"
            onChange={(e) => update([["q", e.target.value]])}
          />
        </InputGroup>
        <ToggleGroup
          className="max-[750px]:max-w-full max-[750px]:overflow-auto"
          value={[view]}
          onValueChange={(v) => {
            if (v[0]) update([["view", v[0]]]);
          }}
          aria-label="مستوى عرض الكتالوج"
        >
          <ToggleGroupItem value="works">العناوين</ToggleGroupItem>
          <ToggleGroupItem value="installments">المواسم والإصدارات</ToggleGroupItem>
        </ToggleGroup>
        <Button ref={filterTrigger} variant="outline" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal data-icon="inline-start" />
          المرشحات{" "}
          {refinementCount(refinements, preset) > 0 && `(${refinementCount(refinements, preset)})`}
        </Button>
      </div>
      <div className="mb-5.5 flex flex-wrap items-center gap-3">
        <OrganizationControls
          sort={sort}
          group={group}
          onSort={(next) => apply({ ...refinements, sort: next })}
          onGroup={(next) => apply({ ...refinements, group: next })}
        />
        <DisplaySettings value={display} onChange={setDisplay} />
      </div>
      <AppliedFilters value={refinements} options={options.data} locked={preset} onChange={apply} />
      {group !== "none" && (
        <p className="mb-4 text-sm text-muted-foreground">
          التجميع يشمل {items.length} نتيجة محمّلة من {result.data?.pages[0].total ?? "…"}. حمّل
          المزيد لإكمال المجموعات.
        </p>
      )}
      {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
      {result.isLoading && <p role="status">جارٍ تحميل الكتالوج…</p>}
      {items.length === 0 && !result.isLoading && !result.error && <NoResults />}
      {Array.from(groups, ([key, entries]) => (
        <section key={key}>
          {key !== "all" && (
            <h2 className="border-b border-border py-5 text-[23px] font-semibold">
              {key} <span className="text-sm text-muted-foreground">({entries.length})</span>
            </h2>
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
                "my-7 grid gap-x-5.5 gap-y-7.5 max-[750px]:gap-x-3.5 max-[750px]:gap-y-6",
                layout === "banner" || layout === "logo"
                  ? cn(
                      "max-[750px]:grid-cols-1",
                      size === "compact"
                        ? "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
                        : size === "comfortable"
                          ? "grid-cols-[repeat(auto-fill,minmax(360px,1fr))]"
                          : "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
                    )
                  : cn(
                      "max-[750px]:grid-cols-2",
                      size === "compact"
                        ? "grid-cols-[repeat(auto-fill,minmax(140px,1fr))]"
                        : size === "comfortable"
                          ? "grid-cols-[repeat(auto-fill,minmax(240px,1fr))]"
                          : "grid-cols-[repeat(auto-fill,minmax(185px,1fr))]",
                    ),
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
          {result.isFetchingNextPage ? "جارٍ التحميل…" : "تحميل المزيد"}
        </Button>
      )}
      {filtersOpen && (
        <FilterDialog
          value={refinements}
          view={view}
          q={q}
          locked={preset}
          returnFocus={filterTrigger}
          onClose={() => setFiltersOpen(false)}
          onApply={(value) => {
            apply(value);
            setFiltersOpen(false);
          }}
        />
      )}
    </section>
  );
}
