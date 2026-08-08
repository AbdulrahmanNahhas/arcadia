import { ArrowLeftIcon, CompassIcon, DatabaseIcon, SparkleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPlatformHome } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WorkRail } from "./components/work-rail";

export function PlatformHome() {
  const { data } = useSuspenseQuery({
    queryKey: ["platform-home"],
    queryFn: () => getPlatformHome(),
  });
  return (
    <PlatformShell immersive>
      <FeaturedHero work={data.featured} />
      <div className="mx-auto flex flex-col gap-16 px-4 pb-28 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        {data.continueExploring.length > 0 && (
          <WorkRail
            title="واصل الاستكشاف"
            description="متابعة مبنية على سجلّك المحلي، دون افتراض وجود تشغيل وسائط."
            works={data.continueExploring}
          />
        )}
        <PlanetIndex planets={data.planets} />
        <WorkRail
          title="وصل حديثاً إلى الأرشيف"
          description="أحدث السجلات التي أضفتها إلى أركاديا."
          works={data.recentlyAdded}
        />
        <WorkRail
          title="الأعلى في تقييمك"
          description="أعمال ارتفعت بفضل معاييرك التفصيلية، لا نتيجة ترتيب عام."
          works={data.highlyRated}
        />
        {data.planets
          .filter((planet) => planet.works.length > 0)
          .map((planet) => (
            <div
              key={planet.id}
              className="relative rounded-2xl border border-white/8 bg-card/35 p-5 sm:p-7"
              style={{ boxShadow: `inset 3px 0 ${planet.primaryColor}66` }}
            >
              <WorkRail
                title={`${planet.icon} ${planet.nameAr}`}
                description={`${planet.workCount} عمل · مرتبة حسب أحدث عرض`}
                works={planet.works}
                href={{ to: "/planets/$planetSlug", params: { planetSlug: planet.slug } }}
              />
            </div>
          ))}
      </div>
    </PlatformShell>
  );
}

function FeaturedHero({ work }: { work: Awaited<ReturnType<typeof getPlatformHome>>["featured"] }) {
  if (!work) {
    return (
      <section className="archive-grid flex min-h-[70svh] items-center px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">أرشيف أركاديا</p>
          <h1 className="mt-4 font-heading text-4xl leading-tight font-semibold sm:text-6xl">
            عوالمك، في خريطة واحدة.
          </h1>
        </div>
      </section>
    );
  }
  return (
    <section className="relative isolate min-h-[76svh] overflow-hidden">
      {work.bannerPath || work.imagePath ? (
        <img
          src={work.bannerPath || work.imagePath || undefined}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-20 size-full object-cover object-center"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-linear-to-l from-background via-background/82 to-background/15" />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-transparent to-black/25" />
      <div className="mx-auto flex min-h-[76svh] max-w-400 items-end px-5 pb-16 pt-28 sm:px-8 lg:items-center lg:pb-8">
        <div className="max-w-2xl">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary">
            <SparkleIcon weight="fill" /> اختيار من أرشيفك
          </p>
          {work.logoPath ? (
            <img
              src={work.logoPath}
              alt={work.arabicTitle || work.title}
              className="max-h-28 max-w-[22rem] object-contain object-right"
            />
          ) : (
            <h1 className="text-balance font-heading text-4xl leading-tight font-semibold sm:text-6xl">
              {work.arabicTitle || work.title}
            </h1>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {work.year ?? "—"} · {work.genres.slice(0, 3).join(" · ")} ·{" "}
            {work.calculatedRating?.toFixed(1) ?? "غير مقيّم"}
          </p>
          <p className="mt-5 line-clamp-3 max-w-xl text-base leading-8 text-foreground/78">
            {work.summary}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/works/$workId"
              params={{ workId: work.id }}
              className={cn(buttonVariants({ size: "lg" }), "rounded-lg px-5")}
            >
              <CompassIcon /> استكشف العمل
            </Link>
            <Link
              to="/database"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "rounded-lg bg-white/10 px-5 backdrop-blur-md hover:bg-white/16",
              )}
            >
              <DatabaseIcon /> افتح السجل
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanetIndex({
  planets,
}: {
  planets: Awaited<ReturnType<typeof getPlatformHome>>["planets"];
}) {
  return (
    <section
      aria-labelledby="planet-index-title"
      className="relative overflow-hidden rounded-2xl border border-white/8 bg-card/40 p-6 sm:p-9"
    >
      <div className="absolute inset-y-0 end-10 hidden w-px bg-linear-to-b from-transparent via-primary/45 to-transparent sm:block" />
      <div className="relative z-10 max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">
          نظام الاكتشاف الأساسي
        </p>
        <h2
          id="planet-index-title"
          className="mt-3 font-heading text-3xl leading-tight font-semibold sm:text-4xl"
        >
          تسعة كواكب، لكل منها مدار.
        </h2>
        <p className="mt-4 leading-8 text-muted-foreground">
          تتغير الأولوية تلقائياً بحسب كثافة أرشيفك. الأعمال داخل كل كوكب تظهر من الأحدث عرضاً إلى
          الأقدم.
        </p>
      </div>
      <div className="mt-8 grid gap-2 lg:grid-cols-3">
        {planets.map((planet, index) => (
          <Link
            key={planet.id}
            to="/planets/$planetSlug"
            params={{ planetSlug: planet.slug }}
            className="group flex items-center gap-4 rounded-xl border border-transparent p-4 transition hover:border-white/10 hover:bg-white/5"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full border text-xl"
              style={{
                borderColor: `${planet.primaryColor}88`,
                background: `${planet.primaryColor}18`,
              }}
            >
              {planet.icon}
            </span>
            <span className="min-w-0">
              <strong className="block truncate font-heading text-sm font-medium">
                {planet.nameAr}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {planet.workCount} عمل · {planet.reviewCount} للمراجعة
              </span>
            </span>
            <ArrowLeftIcon className="ms-auto shrink-0 text-muted-foreground transition group-hover:-translate-x-1 group-hover:text-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}
