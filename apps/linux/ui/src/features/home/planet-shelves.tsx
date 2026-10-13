import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { CatalogPlanet } from "@nahhasio/api-contract";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Select, SelectContent, SelectGroup, SelectItem } from "../../components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { emptyFilters } from "../catalog/filter-model";
import { Shelf } from "./shelf";

export function PlanetShelves({ planets }: { planets: CatalogPlanet[] }) {
  const [type, setType] = useState<"movies" | "series">("series");
  const [planet, setPlanet] = useState("");
  const [day] = useState(() => Math.floor(Date.now() / 86400000));
  const available = planets
    .filter((item) => item.count > 0)
    .toSorted((a, b) => a.slug.localeCompare(b.slug));
  // Daily discovery stays stable while the user explores a world.
  const selected =
    available.find((item) => item.slug === planet) ?? available[day % available.length];
  if (!selected) return null;

  const label = type === "movies" ? "أفلام" : "مسلسلات";
  const filters = {
    ...emptyFilters(),
    facets: [
      { key: "releaseStates", include: ["released"], exclude: [] },
      { key: "planets", include: [selected.slug], exclude: [] },
      {
        key: "kinds",
        include:
          type === "movies"
            ? ["animated-movie", "live-action-movie"]
            : ["animated-series", "live-action-series"],
        exclude: [],
      },
    ],
  };
  return (
    <Shelf
      key={`${selected.slug}-${type}`}
      mediaType={type}
      catalogQuery={{
        view: "works",
        privacy: "public",
        sort: "latest-released-desc",
        filters: JSON.stringify(filters),
      }}
      href={`#/browse?view=works&sort=latest-released-desc&filters=${encodeURIComponent(JSON.stringify(filters))}`}
      heading={
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">استكشف</h2>
          <Select
            items={available.map((item) => ({
              value: item.slug,
              label: `${item.icon} ${item.nameAr}`,
            }))}
            value={selected.slug}
            onValueChange={(value) => {
              if (value) setPlanet(value);
            }}
          >
            <SelectPrimitive.Trigger
              aria-label={`اختر عالم ${label}`}
              className="group/planet inline-flex max-w-full items-center gap-2.5 rounded-lg py-1 text-lg font-semibold outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:gap-3"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-emoji text-2xl sm:size-12"
                aria-hidden="true"
              >
                {selected.icon || "🪐"}
              </span>
              <span className="border-b-2 border-current pb-1">{selected.nameAr}</span>
              <ChevronDown
                className="size-5 shrink-0 text-muted-foreground transition-transform group-data-popup-open/planet:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </SelectPrimitive.Trigger>
            <SelectContent className="w-80 max-w-full" alignItemWithTrigger={false} align="start">
              <SelectGroup>
                {available.map((item) => (
                  <SelectItem key={item.id} value={item.slug}>
                    <span className="flex min-h-12 items-center gap-3">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-emoji text-2xl"
                        aria-hidden="true"
                      >
                        {item.icon || "🪐"}
                      </span>
                      <span className="text-lg">{item.nameAr}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <ToggleGroup
            value={[type]}
            onValueChange={(values) => {
              if (values[0] === "movies" || values[0] === "series") setType(values[0]);
            }}
            aria-label="نوع أعمال العالم"
            size="sm"
          >
            <ToggleGroupItem value="series">مسلسلات</ToggleGroupItem>
            <ToggleGroupItem value="movies">أفلام</ToggleGroupItem>
          </ToggleGroup>
        </div>
      }
    />
  );
}
