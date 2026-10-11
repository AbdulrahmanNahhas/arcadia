import type { CatalogPlanet } from "@nahhasio/api-contract";
import { ArrowUpLeft } from "lucide-react";
import type { CSSProperties } from "react";

import { useCardNavigation } from "../../components/card-navigation";

const validColor = (value: string, fallback: string) =>
  /^#[\da-f]{6}$/i.test(value) ? value : fallback;

function PlanetCard({ planet }: { planet: CatalogPlanet }) {
  const navigation = useCardNavigation();
  const primaryColor = validColor(planet.primaryColor, "var(--accent)");
  const secondaryColor = validColor(planet.secondaryColor, "var(--panel)");

  return (
    <a
      {...navigation}
      href={`#/planets/${planet.slug}`}
      className="group relative isolate flex min-h-60 min-w-0 flex-col items-center justify-center gap-5 overflow-hidden rounded-[28px] border border-white/10 p-6 text-center transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-(--planet)/60 hover:shadow-[0_24px_60px_-24px_var(--planet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transform-none"
      style={
        // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion
        {
          "--planet": primaryColor,
          backgroundImage: `linear-gradient(165deg, ${secondaryColor} 0%, #050505 85%)`,
        } as CSSProperties
      }
    >
      {/* ambient glow, top corner like the Nuvio background */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 transition-opacity duration-500 group-hover:opacity-60"
        style={{
          background:
            "radial-gradient(70% 60% at 15% 0%, color-mix(in oklab, var(--planet) 55%, transparent), transparent 70%)",
        }}
      />

      {/* count pill */}
      <span className="absolute inset-e-4 top-4 inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-foreground/90 backdrop-blur-sm">
        {planet.count} عمل
      </span>

      {/* hover arrow */}
      <span className="absolute inset-s-4 top-4 flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-(--planet) opacity-0 transition-all duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 motion-reduce:transform-none">
        <ArrowUpLeft aria-hidden="true" className="size-4" />
      </span>

      {/* avatar-style circle */}
      <span
        className="relative grid size-24 place-items-center rounded-full border-4 border-black/40 shadow-[0_0_0_2px_color-mix(in_oklab,var(--planet)_45%,transparent),0_0_50px_-8px_var(--planet)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
        style={{ backgroundColor: primaryColor }}
      >
        <span aria-hidden="true" className="font-emoji text-5xl leading-none drop-shadow-sm">
          {planet.icon || "🪐"}
        </span>
      </span>

      <div className="min-w-0 max-w-full">
        <h2 className="truncate text-xl font-extrabold tracking-tight text-foreground" dir="auto">
          {planet.nameAr}
        </h2>
        <p className="mt-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground/80">
          استكشف هذا العالم
        </p>
      </div>
    </a>
  );
}

export function PlanetCards({ planets }: { planets: CatalogPlanet[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-4">
      {planets
        .toSorted((a, b) => b.count - a.count)
        .map((planet) => (
          <PlanetCard key={planet.id} planet={planet} />
        ))}
    </div>
  );
}
