import type { CatalogEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { useCardNavigation, useLoadMoreNavigation } from "../../components/card-navigation";
import { Choice } from "../../components/choice";
import { MediaCard, ScoreBadge } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Button } from "../../components/ui/button";
import { InputGroup, InputGroupInput } from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import type { CatalogQuery } from "../../lib/bridge";
import { replaceParams, workLink } from "../shell/navigation";
import { filterCount, parseFilters, optionLabel } from "./filter-model";
import { FilterSheet } from "./filter-sheet";
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
  const filters = parseFilters(params.get("filters"));
  if (preset && !filters.facets.some((s) => s.key === preset.key))
    filters.facets.push({ key: preset.key, include: [preset.value], exclude: [] });
  const view = params.get("view") === "installments" ? "installments" : "works";
  const privacy =
    params.get("privacy") === "all"
      ? "all"
      : params.get("privacy") === "private"
        ? "private"
        : "public";
  const sort = params.get("sort") || "year-desc";
  const q = params.get("q") || "";
  const [sheet, setSheet] = useState(false);
  const [layout, setLayout] = useState<"poster" | "banner" | "logo" | "table">("poster");
  const [size, setSize] = useState("normal");
  const [group, setGroup] = useState("none");
  const update = (values: Array<[string, string]>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of values) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    replaceParams(path, next);
  };
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const query: CatalogQuery = {
    view,
    privacy,
    q: debounced || undefined,
    sort,
    filters: JSON.stringify(filters),
    yearFrom: params.get("from") ? Number(params.get("from")) : undefined,
    yearTo: params.get("to") ? Number(params.get("to")) : undefined,
  };
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
    const key =
      group === "year"
        ? String(item.installment?.releaseDate?.slice(0, 4) ?? item.work.releaseYear ?? "غير معروف")
        : group === "format"
          ? item.work.format === "animated"
            ? "رسوم متحركة"
            : "تمثيل حي"
          : group === "audience"
            ? optionLabel(item.classification.audience, item.classification.audience)
            : "all";
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
        <InputGroup className="min-w-0 flex-1">
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
        <Button variant="outline" onClick={() => setSheet(true)}>
          <SlidersHorizontal data-icon="inline-start" />
          المرشحات {filterCount(filters) > 0 && `(${filterCount(filters)})`}
        </Button>
      </div>
      <div className="mb-5.5 flex flex-wrap items-center gap-3">
        <Choice
          label="الترتيب"
          value={sort}
          onChange={(v) => update([["sort", v]])}
          options={[
            { value: "year-desc", label: "الأحدث إصدارًا" },
            { value: "year-asc", label: "الأقدم إصدارًا" },
            { value: "score-desc", label: "الأعلى تقييمًا" },
            { value: "title", label: "الاسم" },
            { value: "updated-desc", label: "آخر تحديث" },
            { value: "added-desc", label: "آخر إضافة" },
          ]}
        />
        <Choice
          label="التجميع"
          value={group}
          onChange={setGroup}
          options={[
            { value: "none", label: "بلا تجميع" },
            { value: "year", label: "سنة الإصدار" },
            { value: "format", label: "الصيغة" },
            { value: "audience", label: "الجمهور" },
          ]}
        />
        <ToggleGroup
          aria-label="طريقة العرض"
          value={[layout]}
          onValueChange={(v) => {
            const next = v[0];
            if (next === "poster" || next === "banner" || next === "logo" || next === "table")
              setLayout(next);
          }}
        >
          <ToggleGroupItem value="poster" aria-label="ملصقات">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="banner">لافتات</ToggleGroupItem>
          <ToggleGroupItem value="logo">شعارات</ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="جدول">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
        <Choice
          label="حجم البطاقات"
          value={size}
          onChange={setSize}
          options={[
            { value: "compact", label: "صغيرة" },
            { value: "normal", label: "متوسطة" },
            { value: "comfortable", label: "كبيرة" },
          ]}
        />
      </div>
      {filterCount(filters) > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {filters.facets.flatMap((selection) =>
            [
              ...selection.include.map((value) => ({ value, exclude: false })),
              ...selection.exclude.map((value) => ({ value, exclude: true })),
            ].map(({ value, exclude }) => (
              <Button
                key={`${selection.key}-${value}`}
                variant={exclude ? "destructive" : "secondary"}
                size="sm"
                onClick={() =>
                  update([
                    [
                      "filters",
                      JSON.stringify({
                        ...filters,
                        facets: filters.facets.map((s) =>
                          s.key === selection.key
                            ? {
                                ...s,
                                include: s.include.filter((v) => v !== value),
                                exclude: s.exclude.filter((v) => v !== value),
                              }
                            : s,
                        ),
                      }),
                    ],
                  ])
                }
              >
                {exclude ? "− " : ""}
                {optionLabel(
                  value,
                  options.data?.groups
                    .find((g) => g.key === selection.key)
                    ?.options.find((o) => o.value === value)?.label ?? value,
                )}{" "}
                ×
              </Button>
            )),
          )}
        </div>
      )}
      {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
      {result.isLoading && <p role="status">جارٍ تحميل الكتالوج…</p>}
      {items.length === 0 && !result.isLoading && !result.error && <NoResults />}
      {Array.from(groups, ([key, entries]) => (
        <section key={key}>
          {key !== "all" && (
            <h2 className="border-b border-border py-5 text-[23px] font-semibold">{key}</h2>
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
                        <ScoreBadge score={item.installment?.score ?? item.work.score} />
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
                  ? "grid-cols-[repeat(auto-fill,minmax(280px,1fr))] max-[750px]:grid-cols-1"
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
      <FilterSheet
        open={sheet}
        onOpenChange={setSheet}
        filters={filters}
        onChange={(v) => update([["filters", JSON.stringify(v)]])}
        options={options.data}
        total={result.data?.pages[0].total}
        privacy={privacy}
        onPrivacy={(v) => update([["privacy", v]])}
        yearFrom={params.get("from") ?? ""}
        yearTo={params.get("to") ?? ""}
        onYears={(a, b) =>
          update([
            ["from", a],
            ["to", b],
          ])
        }
      />
    </section>
  );
}
