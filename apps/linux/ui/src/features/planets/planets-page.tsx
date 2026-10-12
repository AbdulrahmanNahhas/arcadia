import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { Failure, NoResults } from "../../components/status";
import { Input } from "../../components/ui/input";
import { gateway } from "../../lib/bridge";
import { BrowsePage } from "../catalog/browse-page";
import { PlanetCards } from "./planet-cards";

function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-105 bg-[radial-gradient(60%_70%_at_85%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%),radial-gradient(40%_50%_at_5%_0%,color-mix(in_oklab,var(--foreground)_4%,transparent),transparent_70%)]"
    />
  );
}

const placeholders = Array.from({ length: 10 }, (_, index) => `planet-placeholder-${index}`);

function PlanetsSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تحميل الكواكب…">
      <span className="sr-only">جارٍ تحميل الكواكب…</span>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {placeholders.map((id) => (
          <Skeleton
            key={id}
            className="aspect-4/5 animate-pulse rounded-3xl border border-white/5 bg-white/4"
          />
        ))}
      </div>
    </div>
  );
}

export function PlanetsPage({ id, params }: { id?: string; params: URLSearchParams }) {
  const result = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const [search, setSearch] = useState("");
  const planets = result.data?.planets ?? [];
  const selected = planets.find((planet) => planet.slug === id);

  if (id)
    return (
      <div className="relative isolate">
        <Glow />
        <a
          className="mx-6 mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-foreground sm:mx-10"
          href="#/planets"
        >
          <ArrowRight size={16} />
          العودة إلى الكواكب
        </a>
        <BrowsePage
          key={id}
          title={selected?.nameAr ?? "أعمال الكوكب"}
          path={`/planets/${id}`}
          params={params}
          preset={{ key: "planets", value: id }}
        />
      </div>
    );

  const matches = planets.filter((planet) =>
    `${planet.nameAr} ${planet.nameEn}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <div className="relative isolate">
      <Glow />
      <section className="mx-auto max-w-400 px-6 py-10 sm:px-10" aria-label="صفحة الكواكب">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight md:text-5xl">
              الكواكب
              {!result.isLoading && !result.error && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-muted-foreground">
                  {planets.length}
                </span>
              )}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              عوالم مكتبتنا، لكل عالم طابعه وحكاياته.
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              aria-hidden
              size={18}
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-12 w-full rounded-full border border-white/10 bg-white/5 ps-11 pe-11 text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:border-primary/60 focus-visible:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="ابحث في الكواكب"
              placeholder="اسم العالم…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <Button
                variant="ghost"
                type="button"
                aria-label="مسح البحث"
                className="absolute end-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </Button>
            )}
          </div>
        </header>

        {result.error ? (
          <Failure error={result.error} retry={() => void result.refetch()} />
        ) : result.isLoading ? (
          <PlanetsSkeleton />
        ) : matches.length ? (
          <PlanetCards planets={matches} />
        ) : (
          <NoResults title="لا توجد كواكب مطابقة" />
        )}
      </section>
    </div>
  );
}
