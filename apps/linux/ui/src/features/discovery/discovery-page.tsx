import { useQuery } from "@tanstack/react-query";
import { ArrowUpLeft, Search } from "lucide-react";
import { useState } from "react";

import { Failure, NoResults } from "../../components/status";
import { Input } from "../../components/ui/input";
import { gateway } from "../../lib/bridge";
import { BrowsePage } from "../catalog/browse-page";
import { PlanetCards } from "./planet-cards";
export function DiscoveryPage({
  type,
  id,
  params,
}: {
  type: string;
  id?: string;
  params: URLSearchParams;
}) {
  const filters = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const facets = useQuery({
    queryKey: ["catalog", "facets", "works", "public"],
    enabled: type !== "planets",
    queryFn: ({ signal }) => gateway.facets({ view: "works", privacy: "public" }, signal),
  });
  const [q, setQ] = useState("");
  const key = type === "studios" ? "studios" : "contributors";
  const entities = facets.data?.groups.find((group) => group.key === key)?.options ?? [];
  const title = type === "planets" ? "الكواكب" : type === "studios" ? "الاستوديوهات" : "الصنّاع";
  const normalizedQuery = q.trim().toLocaleLowerCase();
  const matchingEntities = entities.filter((item) =>
    item.label.toLocaleLowerCase().includes(normalizedQuery),
  );
  const planets = filters.data?.planets ?? [];
  if (id) {
    const label =
      type === "planets"
        ? filters.data?.planets.find((planet) => planet.slug === id)?.nameAr
        : entities.find((item) => item.value === id)?.label;
    return (
      <BrowsePage
        key={`${type}-${id}`}
        title={label ?? "أعمال مرتبطة"}
        path={`/${type}/${id}`}
        params={params}
        preset={{ key: type === "planets" ? "planets" : key, value: id }}
      />
    );
  }
  return (
    <section className="mx-auto max-w-[1600px] px-[clamp(20px,4vw,64px)] py-6 max-[750px]:py-4">
      <header className="mb-6 flex items-end justify-between gap-8 max-[750px]:mb-5 max-[750px]:flex-col max-[750px]:items-stretch max-[750px]:gap-4">
        <div className="min-w-0">
          <h1 className="text-[clamp(26px,2.7vw,38px)] leading-tight font-bold tracking-tight">
            {title}
          </h1>
        </div>

        {type === "planets" ? (
          <p className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
            {filters.data ? new Intl.NumberFormat("ar").format(planets.length) : "…"} عوالم للاستكشاف
          </p>
        ) : (
          <label className="relative block w-full max-w-sm shrink-0 max-[750px]:max-w-none">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={`ابحث في ${title}`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم…"
              className="ps-10"
            />
          </label>
        )}
      </header>
      {filters.error && <Failure error={filters.error} />}
      {facets.error && <Failure error={facets.error} />}
      {type === "planets" ? (
        <>
          {!filters.data && filters.isLoading ? (
            <p className="py-8 text-sm text-muted-foreground" role="status">
              جارٍ تحميل الكواكب…
            </p>
          ) : planets.length > 0 ? (
            <PlanetCards planets={planets} />
          ) : (
            <NoResults title="لا توجد كواكب بعد" />
          )}
        </>
      ) : (
        <>
          {facets.isLoading && entities.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground" role="status">
              جارٍ تحميل الدليل…
            </p>
          ) : matchingEntities.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,235px),1fr))] gap-3.5">
              {matchingEntities.map((item) => (
                <a
                  className="group flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/25 hover:bg-secondary/50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  key={item.value}
                  href={`#/${type}/${item.value}`}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-secondary text-xl font-semibold text-foreground">
                    {item.label.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold" dir="auto">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.count} عمل في المكتبة
                    </span>
                  </span>
                  <ArrowUpLeft
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground motion-reduce:transition-none"
                  />
                </a>
              ))}
            </div>
          ) : (
            <NoResults
              title={normalizedQuery ? "لا توجد نتائج لهذا الاسم" : "لا توجد سجلات مرتبطة"}
              description={normalizedQuery ? "جرّب البحث باسم آخر." : undefined}
            />
          )}
        </>
      )}
    </section>
  );
}
