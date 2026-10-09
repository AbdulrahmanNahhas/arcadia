import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Failure, NoResults } from "../../components/status";
import { Input } from "../../components/ui/input";
import { gateway } from "../../lib/bridge";
import { BrowsePage } from "../catalog/browse-page";
import { PlanetCards } from "./planet-cards";

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
      <>
        <a className="m-6 inline-block text-sm text-muted-foreground" href="#/planets">
          العودة إلى الكواكب
        </a>
        <BrowsePage
          key={id}
          title={selected?.nameAr ?? "أعمال الكوكب"}
          path={`/planets/${id}`}
          params={params}
          preset={{ key: "planets", value: id }}
        />
      </>
    );
  const matches = planets.filter((planet) =>
    `${planet.nameAr} ${planet.nameEn}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section className="mx-auto max-w-400 px-6 py-8 sm:px-10" aria-label="صفحة الكواكب">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold">الكواكب</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            عوالم مكتبتنا، لكل عالم طابعه وحكاياته.
          </p>
        </div>
        <Input
          className="w-full sm:w-72"
          aria-label="ابحث في الكواكب"
          placeholder="اسم العالم…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <p role="status">جارٍ تحميل الكواكب…</p>
      ) : matches.length ? (
        <PlanetCards planets={matches} />
      ) : (
        <NoResults title="لا توجد كواكب مطابقة" />
      )}
    </section>
  );
}
