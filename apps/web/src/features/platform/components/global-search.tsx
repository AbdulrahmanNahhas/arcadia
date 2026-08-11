import {
  BuildingsIcon,
  FilmStripIcon,
  MagnifyingGlassIcon,
  PlanetIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { Entity } from "@/features/library/model";
import type { CatalogSearchResult } from "@/features/platform/model";
import { getEntities } from "@/server/library.functions";
import { searchPlatformCatalog } from "@/server/platform.functions";
import { EntityDialog } from "./entity-dialog";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useQuery({
    queryKey: ["platform-search", settledQuery],
    queryFn: () => searchPlatformCatalog({ data: { query: settledQuery, limit: 32 } }),
    enabled: settledQuery.trim().length > 0,
  });
  const entities = useQuery({ queryKey: ["entities"], queryFn: () => getEntities() });
  const grouped = useMemo(() => groupResults(results.data ?? []), [results.data]);

  function select(result: CatalogSearchResult) {
    setOpen(false);
    if (result.type === "work") {
      void navigate({ to: "/titles/$titleId", params: { titleId: result.id } });
      return;
    }
    if (result.type === "planet") {
      void navigate({ to: "/planets/$planetSlug", params: { planetSlug: result.slug } });
      return;
    }
    const entity = entities.data?.find((item) => item.id === result.id) ?? null;
    setSelectedEntity(entity);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 min-w-9 justify-start border-border/80 bg-background/10 backdrop-blur-lg px-2 text-muted-foreground hover:bg-white/10 hover:text-foreground sm:w-64 sm:px-3"
      >
        <MagnifyingGlassIcon />
        <span className="hidden sm:inline">ابحث في الأرشيف…</span>
        <span className="sr-only sm:hidden">البحث</span>
        <kbd className="ms-auto hidden rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] md:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="البحث الشامل"
        description="ابحث في الأعمال والأشخاص والاستوديوهات والكواكب"
        className="platform-surface top-[12vh] max-w-2xl translate-y-0 rounded-2xl! border-white/10 bg-popover/96"
      >
        <Command shouldFilter={false} className="rounded-2xl p-2">
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="اكتب عنوان عمل، شخص، استوديو أو كوكب…"
            aria-label="البحث في نحّاسينما"
          />
          <CommandList className="max-h-[62svh]">
            {!query.trim() ? (
              <div className="p-8 text-center text-sm leading-7 text-muted-foreground">
                ابحث بالعربية أو الإنجليزية. تستطيع الانتقال مباشرة إلى الأعمال والكواكب، أو فتح
                ملخصات الأشخاص والاستوديوهات دون مغادرة الصفحة.
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {results.isFetching ? "جارٍ البحث…" : "لا توجد نتائج مطابقة."}
                </CommandEmpty>
                {resultGroups.map(({ type, label, icon: Icon }, index) => {
                  const items = grouped[type] ?? [];
                  if (!items.length) return null;
                  return (
                    <div key={type}>
                      {index > 0 && <CommandSeparator />}
                      <CommandGroup heading={label}>
                        {items.map((result) => (
                          <CommandItem
                            key={`${result.type}:${result.id}`}
                            value={`${result.type}:${result.id}`}
                            onSelect={() => select(result)}
                            className="py-3"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                              {"imagePath" in result && result.imagePath ? (
                                <img
                                  src={result.imagePath}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : result.type === "planet" ? (
                                <span className="text-lg">{result.icon}</span>
                              ) : (
                                <Icon />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{result.title}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {result.subtitle}
                              </span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </div>
                  );
                })}
              </>
            )}
          </CommandList>
          <div className="flex items-center gap-2 border-t border-white/8 px-3 pt-2 text-[11px] text-muted-foreground">
            <CommandShortcut>↵ فتح</CommandShortcut>
            <span>↑↓ تنقّل</span>
            <span>Esc إغلاق</span>
          </div>
        </Command>
      </CommandDialog>
      {selectedEntity && (
        <EntityDialog
          entity={selectedEntity}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedEntity(null);
          }}
        />
      )}
    </>
  );
}

const resultGroups = [
  { type: "work", label: "الأعمال", icon: FilmStripIcon },
  { type: "person", label: "الأشخاص", icon: UserIcon },
  { type: "studio", label: "الاستوديوهات والمنظمات", icon: BuildingsIcon },
  { type: "planet", label: "الكواكب", icon: PlanetIcon },
] as const;

function groupResults(results: CatalogSearchResult[]) {
  return results.reduce<Partial<Record<CatalogSearchResult["type"], CatalogSearchResult[]>>>(
    (groups, result) => {
      const group = groups[result.type] ?? [];
      groups[result.type] = group;
      group.push(result);
      return groups;
    },
    {},
  );
}
