import {
  BuildingsIcon,
  ClockCounterClockwiseIcon,
  FilmStripIcon,
  MagnifyingGlassIcon,
  PlanetIcon,
  TrashIcon,
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
import { useCurrentAccount } from "@/features/accounts/api";
import type { CatalogSearchResult } from "@/features/platform/model";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberRecentSearch,
  removeRecentSearch,
} from "@/features/platform/recent-searches";
import { searchPlatformCatalog } from "@/server/platform.functions";

export function GlobalSearch() {
  const navigate = useNavigate();
  const accountId = useCurrentAccount().data?.account.id;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [recentState, setRecentState] = useState<{
    accountId: string | undefined;
    searches: string[];
  }>({ accountId: undefined, searches: [] });
  const recentSearches = recentState.accountId === accountId ? recentState.searches : [];

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        if (accountId) {
          setRecentState({
            accountId,
            searches: readRecentSearches(accountId, window.localStorage),
          });
        }
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [accountId]);

  const results = useQuery({
    queryKey: ["platform-search", settledQuery],
    queryFn: () => searchPlatformCatalog({ data: { query: settledQuery, limit: 32 } }),
    enabled: settledQuery.trim().length > 0,
  });
  const grouped = useMemo(() => groupResults(results.data ?? []), [results.data]);

  function select(result: CatalogSearchResult) {
    if (accountId) {
      setRecentState({
        accountId,
        searches: rememberRecentSearch(accountId, query, window.localStorage),
      });
    }
    setOpen(false);
    if (result.type === "work") {
      void navigate({ to: "/titles/$titleId", params: { titleId: result.id } });
      return;
    }
    if (result.type === "planet") {
      void navigate({ to: "/planets/$planetSlug", params: { planetSlug: result.slug } });
      return;
    }
    if (result.type === "person") {
      void navigate({ to: "/people/$personId", params: { personId: result.id } });
      return;
    }
    void navigate({ to: "/studios/$studioId", params: { studioId: result.id } });
  }

  function openAllResults() {
    const term = query.trim();
    if (!term) return;
    if (accountId) {
      setRecentState({
        accountId,
        searches: rememberRecentSearch(accountId, term, window.localStorage),
      });
    }
    setOpen(false);
    void navigate({ to: "/browse", search: { q: term } });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          if (accountId) {
            setRecentState({
              accountId,
              searches: readRecentSearches(accountId, window.localStorage),
            });
          }
          setOpen(true);
        }}
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
        onOpenChange={(nextOpen) => {
          if (nextOpen && accountId) {
            setRecentState({
              accountId,
              searches: readRecentSearches(accountId, window.localStorage),
            });
          }
          setOpen(nextOpen);
        }}
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
              recentSearches.length ? (
                <>
                  <CommandGroup heading="عمليات البحث الأخيرة">
                    {recentSearches.map((term) => (
                      <CommandItem
                        key={term}
                        value={`recent:${term}`}
                        onSelect={() => setQuery(term)}
                        className="py-3"
                      >
                        <ClockCounterClockwiseIcon />
                        <span className="min-w-0 flex-1 truncate">{term}</span>
                        <button
                          type="button"
                          aria-label={`حذف بحث ${term}`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!accountId) return;
                            setRecentState({
                              accountId,
                              searches: removeRecentSearch(accountId, term, window.localStorage),
                            });
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <TrashIcon />
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="clear-recent-searches"
                      onSelect={() => {
                        if (!accountId) return;
                        clearRecentSearches(accountId, window.localStorage);
                        setRecentState({ accountId, searches: [] });
                      }}
                    >
                      <TrashIcon />
                      مسح عمليات البحث
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : (
                <div className="p-8 text-center text-sm leading-7 text-muted-foreground">
                  ابحث بالعربية أو الإنجليزية، ثم انتقل مباشرة إلى صفحة العمل أو الشخص أو الاستوديو
                  أو الكوكب.
                </div>
              )
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
                      <CommandGroup heading={`${label} · ${items.length}`}>
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
                {(results.data?.length ?? 0) >= 32 ? (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem value="all-results" onSelect={openAllResults} className="py-3">
                        <MagnifyingGlassIcon />
                        عرض كل النتائج في قاعدة البيانات
                      </CommandItem>
                    </CommandGroup>
                  </>
                ) : null}
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
