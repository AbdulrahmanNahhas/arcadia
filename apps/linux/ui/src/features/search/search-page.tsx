import type { FacetCatalog } from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowUpLeft, Building2, LoaderCircle, Orbit, Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import { entityLink, replaceParams } from "../shell/navigation";
import { parseSearchType, searchCatalogOptions, searchTypes } from "./search-model";
import type { SearchType } from "./search-model";

const entityTypes = [
  { key: "contributors", type: "people", label: "الصنّاع", icon: Users },
  { key: "studios", type: "studios", label: "الاستوديوهات", icon: Building2 },
  { key: "planets", type: "planets", label: "الكواكب", icon: Orbit },
] as const;
function matchingEntities(data: FacetCatalog | undefined, q: string, type: SearchType) {
  return entityTypes
    .filter((group) => type === "all" || type === group.type)
    .flatMap((group) =>
      (data?.groups.find((facet) => facet.key === group.key)?.options ?? [])
        .filter((item) => item.label.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
        .map((item) => ({ ...item, group })),
    );
}
function EntityMatches({ items }: { items: ReturnType<typeof matchingEntities> }) {
  const [limit, setLimit] = useState(12);
  return (
    <section className="mb-10" aria-label="الأسماء والعوالم المطابقة">
      <header className="mb-5 flex items-center gap-3">
        <h2 className="text-lg font-semibold">الأسماء والعوالم</h2>
        <span className="text-xs text-muted-foreground">{items.length} نتيجة</span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, limit).map((item) => (
          <a
            key={`${item.group.key}-${item.value}`}
            href={entityLink(item.group.key, item.value)}
            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary motion-reduce:transition-none"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <item.group.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm" dir="auto">
                {item.label}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.group.label} · {item.count} عمل
              </span>
            </span>
            <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        ))}
      </div>
      {limit < items.length && (
        <Button variant="outline" className="mt-5" onClick={() => setLimit((value) => value + 12)}>
          المزيد من الأسماء والعوالم
        </Button>
      )}
    </section>
  );
}
export function SearchPage({ params }: { params: URLSearchParams }) {
  const input = useRef<HTMLInputElement>(null);
  const text = (params.get("q") ?? "").slice(0, 200);
  const type = parseSearchType(params.get("type"));
  const includePrivate = params.get("privacy") === "all";
  const [q, setQ] = useState(text.trim());
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    replaceParams("/search", next);
  };
  useEffect(() => {
    const focus = () => {
      input.current?.focus({ preventScroll: true });
    };
    focus();
    window.addEventListener("nahhasio:focus-search", focus);
    return () => window.removeEventListener("nahhasio:focus-search", focus);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const works = useInfiniteQuery(searchCatalogOptions(q, type, includePrivate));
  const showWorks = ["all", "movies", "series", "installments"].includes(type);
  const showEntities = ["all", "people", "studios", "planets"].includes(type);
  const facets = useQuery({
    queryKey: ["catalog", "search-entities", includePrivate ? "all" : "public"],
    enabled: q.length > 0 && showEntities,
    queryFn: ({ signal }) =>
      gateway.facets({ view: "works", privacy: includePrivate ? "all" : "public" }, signal),
  });
  const entities = matchingEntities(facets.data, q, type);
  const entries = works.data?.pages.flatMap((page) => page.items) ?? [];
  const total =
    (showWorks ? (works.data?.pages[0].total ?? 0) : 0) + (showEntities ? entities.length : 0);
  const waiting =
    text.trim() !== q || (showWorks && works.isLoading) || (showEntities && facets.isLoading);
  const error =
    (showWorks && !works.isFetchNextPageError ? works.error : null) ??
    (showEntities ? facets.error : null);
  return (
    <section
      className="mx-auto min-h-full max-w-400 px-5 py-8 sm:px-9 sm:py-12 lg:px-14"
      aria-label="صفحة البحث"
    >
      <header className="mb-9 flex items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl leading-relaxed font-semibold sm:text-5xl">
            ما الحكاية التي تبحث عنها؟
          </h1>
          <p className="mt-4 max-w-160 text-sm leading-loose text-muted-foreground">
            ابحث بعنوان، اسم بديل، أو صانع. الأعمال والأجزاء والأسماء والعوالم، في مكان واحد.
          </p>
        </div>
        <span className="hidden size-18 shrink-0 place-items-center rounded-3xl border border-border bg-card text-primary lg:grid">
          <Search className="size-8 stroke-[1.5]" aria-hidden="true" />
        </span>
      </header>
      <div className="mb-6 shadow-xs backdrop-blur-sm">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(text.trim());
          }}
        >
          <InputGroup className="h-12 bg-background/80 rounded-xl transition-all focus-within:ring-2 focus-within:ring-ring/20">
            <InputGroupAddon>
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              ref={input}
              id="library-search"
              role="searchbox"
              aria-label="ابحث في المكتبة"
              value={text}
              maxLength={200}
              autoComplete="off"
              placeholder="عنوان عمل، اسم صانع، أو عالم…"
              className="text-sm placeholder:text-muted-foreground/70"
              onChange={(event) => update("q", event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              {text && (
                <InputGroupButton
                  aria-label="مسح البحث"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    update("q", "");
                    input.current?.focus();
                  }}
                >
                  <X className="size-3.5" />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 max-w-full overflow-x-auto pb-0.5">
            <ToggleGroup
              value={[type]}
              onValueChange={(values) => {
                const next = values[0];
                if (next) update("type", parseSearchType(next));
              }}
              variant="outline"
              size="sm"
              aria-label="نوع البحث"
              className="inline-flex"
            >
              {searchTypes.map((item) => (
                <ToggleGroupItem
                  key={item.value}
                  value={item.value}
                  aria-label={item.label}
                  className="gap-1.5 rounded-lg px-3 py-1 text-xs font-medium"
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <label
            htmlFor="search-private"
            className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Checkbox
              id="search-private"
              checked={includePrivate}
              onCheckedChange={(checked) => update("privacy", checked ? "all" : "")}
              className="size-4 rounded"
            />
            <span>تضمين الأعمال الخاصة</span>
          </label>
        </div>
      </div>
      {!text.trim() ? (
        <div className="mx-auto flex max-w-150 flex-col items-center gap-4 py-12 text-center sm:py-20">
          <span className="grid size-20 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
            <Search className="size-9 stroke-[1.25]" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">كل مكتبتك، أقرب بكلمة</h2>
          <p className="max-w-110 text-sm leading-loose text-muted-foreground">
            ابدأ بكتابة ما تتذكره، ثم اختر نوعًا لتصل إلى النتيجة أسرع.
          </p>
        </div>
      ) : (
        <>
          <header
            className="mb-7 flex flex-wrap items-center justify-between gap-3"
            aria-live="polite"
          >
            <h2 className="text-lg font-semibold">نتائج «{text.trim()}»</h2>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {waiting ? (
                <>
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  جارٍ البحث…
                </>
              ) : (
                `${total} نتيجة`
              )}
            </p>
          </header>
          {error && (
            <Failure
              error={error}
              retry={() => {
                if (showWorks) void works.refetch();
                if (showEntities) void facets.refetch();
              }}
            />
          )}
          {!waiting && !error && total === 0 && (
            <NoResults
              title="لا توجد نتائج مطابقة"
              description="جرّب اسمًا آخر أو اختر «الكل» لتوسيع البحث."
            />
          )}
          {!waiting && showEntities && entities.length > 0 && (
            <EntityMatches key={`${q}-${type}-${includePrivate}`} items={entities} />
          )}
          {!waiting && showWorks && entries.length > 0 && (
            <section aria-label="الأعمال المطابقة">
              <header className="mb-5 flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {type === "installments" ? "الأجزاء" : "الأعمال"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {works.data?.pages[0].total} نتيجة
                </span>
              </header>
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {entries.map((entry) => (
                  <MediaCard key={entry.installment?.id ?? entry.work.id} entry={entry} />
                ))}
              </div>
              {works.hasNextPage && (
                <div className="mt-9 flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={works.isFetchingNextPage}
                    onClick={() => void works.fetchNextPage()}
                  >
                    {works.isFetchingNextPage ? "جارٍ تحميل المزيد…" : "المزيد من النتائج"}
                  </Button>
                </div>
              )}
              {works.isFetchNextPageError && (
                <Failure
                  error={works.error ?? new Error("تعذّر تحميل المزيد.")}
                  retry={() => void works.fetchNextPage()}
                />
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
