import { PlayIcon } from "@phosphor-icons/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { archiveKeys, getContinueWatching } from "@/features/archive/api";
import { planetsQueryOptions, railQueryOptions } from "./api";
import { cardItemFromResume, cardItemFromTitle, type DisplayCardItem } from "./display-card";
import { DisplayRail } from "./display-rail";
import { DisplayShell } from "./display-shell";

/**
 * Display Home. The hero is not a carousel: it is whatever card is selected — banner, logo
 * or title, year — so the picture on screen always matches the thing the remote is on. Rails:
 * continue watching, top rated, newest, then one per planet, each a single paged request.
 */
export function DisplayHome() {
  const continueWatching = useQuery({
    queryKey: archiveKeys.continueWatching,
    queryFn: getContinueWatching,
    staleTime: 30_000,
  });
  const topRated = useQuery(railQueryOptions("top", { sort: "score", limit: 20 }));
  const newest = useQuery(railQueryOptions("new", { sort: "release", limit: 20 }));
  const planets = useQuery(planetsQueryOptions());
  const planetRails = useQueries({
    queries: (planets.data ?? []).slice(0, 6).map((planet) =>
      railQueryOptions(`planet:${planet.slug}`, {
        planet: planet.slug,
        sort: "score",
        limit: 16,
      }),
    ),
  });

  const continueItems = useMemo<DisplayCardItem[]>(
    () => (continueWatching.data?.inProgress ?? []).map(cardItemFromResume),
    [continueWatching.data],
  );
  const topItems = useMemo(() => (topRated.data ?? []).map(cardItemFromTitle), [topRated.data]);
  const newItems = useMemo(() => (newest.data ?? []).map(cardItemFromTitle), [newest.data]);

  const [featured, setFeatured] = useState<DisplayCardItem | null>(null);
  const hero = featured ?? continueItems[0] ?? topItems[0] ?? null;
  useEffect(() => {
    // Preload the first few banners so the hero swap is instant once the remote moves.
    for (const item of [...continueItems, ...topItems].slice(0, 8)) {
      if (item.bannerPath) new Image().src = item.bannerPath;
    }
  }, [continueItems, topItems]);

  return (
    <DisplayShell>
      <div className="relative -mt-28 min-h-[70vh]">
        {hero?.bannerPath || hero?.posterPath ? (
          <img
            key={hero.id}
            src={hero.bannerPath ?? hero.posterPath ?? ""}
            alt=""
            className="absolute inset-0 size-full object-cover animate-in fade-in-0 duration-500"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-transparent to-transparent" />
        <div className="relative flex min-h-[70vh] flex-col justify-end gap-4 px-[5vw] pb-16 pt-32">
          {hero && (
            <>
              <h1 className="max-w-[55vw] font-heading text-5xl font-bold leading-tight drop-shadow-lg">
                {hero.title}
              </h1>
              {hero.subtitle && <p className="text-xl text-white/80">{hero.subtitle}</p>}
              <div className="mt-2 flex items-center gap-3">
                <Link
                  to={"installmentId" in hero.to ? "/player/$installmentId" : "/titles/$titleId"}
                  params={
                    "installmentId" in hero.to
                      ? { installmentId: hero.to.installmentId }
                      : { titleId: hero.to.titleId }
                  }
                  search={
                    "installmentId" in hero.to
                      ? { titleId: hero.to.titleId, episodeId: hero.to.episodeId, origin: "/" }
                      : {}
                  }
                  data-display-chrome
                  className="flex items-center gap-2 rounded-full bg-white px-7 py-3 text-lg font-bold text-black outline-none"
                >
                  <PlayIcon weight="fill" size={24} />
                  {"installmentId" in hero.to ? "متابعة المشاهدة" : "التفاصيل"}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="relative z-10 -mt-6 flex flex-col gap-10 pb-24">
        <DisplayRail
          title="متابعة المشاهدة"
          items={continueItems}
          variant="banner"
          onFocusItem={setFeatured}
        />
        <DisplayRail title="الأعلى تقييماً" items={topItems} onFocusItem={setFeatured} />
        <DisplayRail title="الأحدث" items={newItems} onFocusItem={setFeatured} />
        {(planets.data ?? []).slice(0, 6).map((planet, index) => (
          <DisplayRail
            key={planet.id}
            title={`${planet.icon} ${planet.nameAr}`}
            items={(planetRails[index]?.data ?? []).map(cardItemFromTitle)}
            onFocusItem={setFeatured}
          />
        ))}
      </div>
    </DisplayShell>
  );
}
