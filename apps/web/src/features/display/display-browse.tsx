import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { FocusContext, useSpatialFocusable } from "@/features/platform/spatial-navigation";
import { cn } from "@/lib/utils";
import { type BrowseSort, browseInfiniteQueryOptions, planetsQueryOptions } from "./api";
import { cardItemFromTitle, DisplayCard } from "./display-card";
import { DisplayShell } from "./display-shell";

const sorts: Array<[BrowseSort, string]> = [
  ["score", "الأعلى تقييماً"],
  ["release", "الأحدث"],
  ["title", "الاسم"],
];

/**
 * Display Browse: one row of filter pills (sort, then planets) above a poster grid that pages
 * itself as the selection reaches the last rows. No facet drawer — the remote needs three
 * choices, not twenty-one.
 */
export function DisplayBrowse({ initialQuery = "" }: { initialQuery?: string }) {
  const [sort, setSort] = useState<BrowseSort>("score");
  const [planet, setPlanet] = useState<string | undefined>(undefined);
  const planets = useQuery(planetsQueryOptions());
  const pages = useInfiniteQuery(
    browseInfiniteQueryOptions({ sort, planet, q: initialQuery || undefined }),
  );
  const items = useMemo(
    () => (pages.data?.pages ?? []).flatMap((page) => page.items).map(cardItemFromTitle),
    [pages.data],
  );
  const total = pages.data?.pages[0]?.total ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { ref: gridRef, focusKey: gridKey } = useSpatialFocusable<object, HTMLDivElement>({
    trackChildren: true,
  });
  const planetOptions: Array<[string, string]> = [
    ["", "كل الكواكب"],
    ...(planets.data ?? []).map((p): [string, string] => [p.slug, `${p.icon} ${p.nameAr}`]),
  ];

  return (
    <DisplayShell>
      <div className="flex flex-col gap-6 px-[5vw] pb-24">
        <div className="flex flex-wrap items-center gap-3">
          {initialQuery && <span className="text-lg text-white/70">نتائج «{initialQuery}»</span>}
          <Pills value={sort} options={sorts} onChange={setSort} />
          {planets.data && planets.data.length > 0 && (
            <Pills
              value={planet ?? ""}
              options={planetOptions}
              onChange={(value) => setPlanet(value || undefined)}
            />
          )}
          <span className="ms-auto text-base text-white/50">{total.toLocaleString("ar")} عمل</span>
        </div>
        <FocusContext.Provider value={gridKey}>
          <div
            ref={gridRef}
            data-display-rail
            className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-x-5 gap-y-8 pt-4"
          >
            {items.map((item, index) => (
              <DisplayCard key={item.id} item={item} focusKey={`browse:${index}`} />
            ))}
          </div>
        </FocusContext.Provider>
        <div ref={sentinel} className="h-8" />
        {pages.isFetchingNextPage && <p className="text-center text-white/50">جارٍ التحميل…</p>}
        {!pages.isPending && items.length === 0 && (
          <p className="py-20 text-center text-xl text-white/60">لا أعمال هنا.</p>
        )}
      </div>
    </DisplayShell>
  );
}

function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([option, label]) => (
        <button
          key={option || "all"}
          type="button"
          data-display-chrome
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full px-4 py-2 text-base font-medium outline-none transition-colors",
            value === option ? "bg-white/20 text-white" : "bg-white/5 text-white/70",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
