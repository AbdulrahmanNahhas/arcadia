import type { CatalogPlanet } from "@nahhasio/api-contract";
import {
  ArrowUpLeft,
  Baby,
  BookOpen,
  Bot,
  Compass,
  Eye,
  Flower2,
  Laugh,
  Orbit,
  Rocket,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { useCardNavigation } from "../../components/card-navigation";

const planetIconClass = "size-3 stroke-2";
const planetIcons = new Map<string, ReactNode>([
  ["fantasy", <Sparkles key="fantasy" aria-hidden="true" className={planetIconClass} />],
  ["action", <Zap key="action" aria-hidden="true" className={planetIconClass} />],
  ["adventure", <Compass key="adventure" aria-hidden="true" className={planetIconClass} />],
  ["emerald", <Flower2 key="emerald" aria-hidden="true" className={planetIconClass} />],
  [
    "sports-challenge",
    <Trophy key="sports-challenge" aria-hidden="true" className={planetIconClass} />,
  ],
  [
    "civilizations",
    <BookOpen key="civilizations" aria-hidden="true" className={planetIconClass} />,
  ],
  ["comedy", <Laugh key="comedy" aria-hidden="true" className={planetIconClass} />],
  ["mystery", <Eye key="mystery" aria-hidden="true" className={planetIconClass} />],
  ["space", <Rocket key="space" aria-hidden="true" className={planetIconClass} />],
  ["future", <Bot key="future" aria-hidden="true" className={planetIconClass} />],
  ["bonbon", <Baby key="bonbon" aria-hidden="true" className={planetIconClass} />],
]);

const validColor = (value: string, fallback: string) =>
  /^#[\da-f]{6}$/i.test(value) ? value : fallback;

function PlanetCard({ planet }: { planet: CatalogPlanet }) {
  const navigation = useCardNavigation();
  const primaryColor = validColor(planet.primaryColor, "var(--accent)");
  const secondaryColor = validColor(planet.secondaryColor, "var(--panel)");

  const planetIcon = planetIcons.get(planet.slug) ?? (
    <Orbit aria-hidden="true" className={planetIconClass} />
  );

  return (
    <a
      {...navigation}
      href={`#/planets/${planet.slug}`}
      className="group relative flex min-h-44 min-w-0 flex-col justify-between overflow-hidden rounded-3xl border p-6 transition-[filter,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none"
      style={{
        backgroundColor: secondaryColor,
        borderColor: `${primaryColor}55`,
        color: primaryColor,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 bg-[radial-gradient(circle_at_top_right,currentColor,transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-15"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-e-8 -bottom-16 size-48 rounded-full border border-current/15 transition-transform duration-700 ease-out group-hover:scale-110 group-hover:rotate-12 after:absolute after:inset-4 after:rounded-full after:border after:border-current/10 motion-reduce:transform-none"
      />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <span className="relative grid size-14 place-items-center rounded-2xl border border-current/25 bg-background/45 shadow-xs transition-colors group-hover:border-current/50">
          <span aria-hidden="true" className="font-emoji text-3xl leading-none">
            {planet.icon || "🪐"}
          </span>
          <span className="absolute -bottom-1 -inset-e-1 grid size-5 place-items-center rounded-full border border-current/30 bg-background text-current shadow-sm">
            {planetIcon}
          </span>
        </span>
        <span className="inline-flex items-center rounded-full border border-current/20 bg-background/40 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-xs">
          {planet.count} عمل
        </span>
      </div>
      <div className="relative z-10 mt-8 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            className="truncate text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-current"
            dir="auto"
          >
            {planet.nameAr}
          </h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground/80">استكشف هذا العالم</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-current/20 bg-background/30 text-current transition-all  group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 duration-300">
          <ArrowUpLeft aria-hidden="true" className="size-4 transition-transform duration-200" />
        </span>
      </div>
    </a>
  );
}

export function PlanetCards({ planets }: { planets: CatalogPlanet[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3.5">
      {planets
        .toSorted((a, b) => b.count - a.count)
        .map((planet) => (
          <PlanetCard key={planet.id} planet={planet} />
        ))}
    </div>
  );
}
