import { ArrowLeftIcon, BuildingsIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getTopStudios } from "@/server/platform.functions";
import { RailHeader, RailScroller, railActionClass } from "./rail";

/** Bottom-of-home "الاستوديوهات": the studios with the deepest catalog presence, as a row of
 *  logo chips rather than full work-cards — a studio's own page is one click away for anyone who
 *  wants its filmography, so this is a directory shortcut, not another rail of posters. */
export function StudiosRail() {
  const query = useQuery({
    queryKey: ["platform-home", "top-studios"],
    queryFn: () => getTopStudios(),
  });
  const studios = query.data ?? [];
  if (!studios.length) return null;
  return (
    <section className="scroll-mt-24 overflow-hidden" aria-labelledby="studios-rail-title">
      <RailHeader
        id="studios-rail-title"
        title="الاستوديوهات"
        description="شركات الإنتاج الأكثر حضوراً في الكتالوج."
        action={
          <Link to="/studios" className={railActionClass}>
            كل الاستوديوهات
            <ArrowLeftIcon />
          </Link>
        }
      />
      <RailScroller className="auto-cols-34 gap-3 pb-5 sm:auto-cols-38">
        {studios.map((studio) => (
          <Link
            key={studio.id}
            to="/studios/$studioId"
            params={{ studioId: studio.id }}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-transparent p-3 text-center transition hover:border-border hover:bg-card"
          >
            <span className="flex size-32 items-center justify-center overflow-hidden rounded-2xl border bg-card shadow-sm">
              {studio.imagePath ? (
                <img
                  src={studio.imagePath}
                  alt=""
                  loading="lazy"
                  data-on-artwork
                  className="size-full object-contain p-0 bg-white"
                />
              ) : (
                <BuildingsIcon className="size-6 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0">
              <strong className="block line-clamp-2 text-sm font-medium group-hover:text-primary">
                {studio.name}
              </strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {studio.workCount} عمل
              </span>
            </span>
          </Link>
        ))}
      </RailScroller>
    </section>
  );
}
