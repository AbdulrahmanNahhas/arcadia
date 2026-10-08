import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Grid2X2Icon,
  ListIcon,
  TableIcon,
  RefreshCwIcon,
  XIcon,
  BracesIcon,
  CheckCheckIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CatalogSearch } from "@/features/catalog/works/works-model";
import { WorksToolbar, WorksFilters, CatalogSelect } from "@/features/catalog/works/works-toolbar";
import { WorksGallery, WorksList, WorksTable } from "@/features/catalog/works/works-views";
import { worksPageOptions } from "@/features/catalog/works/works.queries";
import { getWorksSelection } from "@/features/database/data/database.functions";

// The URL owns the search. Only request scheduling is delayed, never the input.
function useSearchDelay(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), 250);
    return () => window.clearTimeout(timer);
  }, [value]);
  return settled;
}
export function WorksCatalog() {
  const state = useSearch({ from: "__root__" });
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const posterSize = state.size ?? (state.density === "compact" ? 1 : 2);
  const search = useSearchDelay(state.q ?? "");
  const view = state.view ?? "grid";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,[contenteditable=true],[role=dialog]"))
      )
        return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const criteria = {
    search,
    structure: state.structure,
    format: state.format,
    workflow: state.workflow,
    visibility: state.visibility,
    gap: state.gap,
    sort: state.sort,
  };
  const scope = JSON.stringify({ ...criteria, search: state.q ?? "" });
  const scopeRef = useRef(scope);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope, scopeRef]);
  const selection = useMutation({
    mutationFn: (input: typeof criteria) => getWorksSelection({ data: input }),
    onSuccess: (ids, input) => {
      if (JSON.stringify(input) === scopeRef.current) {
        setSelected((current) => new Set([...current, ...ids]));
        setFullSelection({ scope: JSON.stringify(input), ids });
      }
    },
  });
  const [fullSelection, setFullSelection] = useState<{ scope: string; ids: string[] } | null>(null);
  const query = useInfiniteQuery(worksPageOptions(criteria));
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total;
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;
  const searchPending = search !== (state.q ?? "");
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || isFetching || isFetchNextPageError || searchPending) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, searchPending]);
  const updating = query.isFetching || search !== (state.q ?? "");
  const selectionDisabled = search !== (state.q ?? "") || query.isError || selection.isPending;
  const allSelected =
    fullSelection?.scope === scope &&
    fullSelection.ids.length > 0 &&
    fullSelection.ids.every((id) => selected.has(id));
  const activeFilters = [
    state.q,
    state.structure,
    state.format,
    state.workflow,
    state.visibility,
    state.gap,
  ].filter(Boolean).length;
  function filters(patch: CatalogSearch & { q?: string }) {
    void navigate({
      to: ".",
      replace: Object.hasOwn(patch, "q"),
      search: (previous) => ({ ...previous, ...patch, offset: 0 }),
    });
  }
  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function selectAll(checked: boolean) {
    if (checked) selection.mutate(criteria);
    else if (fullSelection?.scope === scope) {
      const ids = new Set(fullSelection.ids);
      setSelected((current) => new Set([...current].filter((id) => !ids.has(id))));
      setFullSelection(null);
    }
  }
  function clearSelection() {
    setSelected(new Set());
    setFullSelection(null);
    selection.reset();
  }
  const viewProps = {
    items,
    selected,
    onSelect: toggle,
    disabled: selectionDisabled,
  };
  return (
    <section
      aria-label="كتالوج الأعمال"
      className="@container/catalog flex min-w-0 max-w-full flex-col gap-4"
    >
      <WorksToolbar state={state} searchRef={searchRef} onChange={filters} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox
            id="select-page"
            checked={allSelected}
            indeterminate={!allSelected && items.some(({ work }) => selected.has(work.id))}
            disabled={items.length === 0 || selectionDisabled}
            onCheckedChange={selectAll}
          />
          <label htmlFor="select-page" className="text-sm">
            تحديد الكل
          </label>
          <span className="text-sm text-muted-foreground">· {total ?? "…"} عمل</span>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                filters({
                  q: undefined,
                  structure: undefined,
                  format: undefined,
                  workflow: undefined,
                  visibility: undefined,
                  gap: undefined,
                })
              }
            >
              <XIcon data-icon="inline-start" />
              مسح التصفية ({activeFilters})
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorksFilters state={state} onChange={filters} />
          <CatalogSelect
            label="الترتيب"
            value={state.sort ?? "title"}
            onChange={(sort) => filters({ sort })}
            choices={[
              { value: "title", label: "الاسم" },
              { value: "year-desc", label: "الأحدث إصداراً" },
              { value: "year-asc", label: "الأقدم إصداراً" },
              { value: "updated", label: "آخر تعديل" },
            ]}
          />
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[view]}
            aria-label="طريقة العرض"
            onValueChange={(values) => {
              const next = values[0];
              if (next === "grid" || next === "table" || next === "list")
                void navigate({ to: ".", search: (previous) => ({ ...previous, view: next }) });
            }}
          >
            <ToggleGroupItem value="grid" aria-label="عرض البطاقات" title="ملصقات">
              <Grid2X2Icon data-icon="inline-start" />
              <span className="hidden @2xl/catalog:inline">ملصقات</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="عرض القائمة" title="قائمة مفصّلة">
              <ListIcon data-icon="inline-start" />
              <span className="hidden @2xl/catalog:inline">قائمة</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="عرض الجدول" title="جدول">
              <TableIcon data-icon="inline-start" />
              <span className="hidden @2xl/catalog:inline">جدول</span>
            </ToggleGroupItem>
          </ToggleGroup>
          {view === "grid" && (
            <Field orientation="horizontal" className="w-36">
              <FieldLabel id="poster-size-label" htmlFor="poster-size" className="sr-only">
                حجم الملصقات
              </FieldLabel>
              <Grid2X2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Slider
                id="poster-size"
                aria-labelledby="poster-size-label"
                min={1}
                max={4}
                step={1}
                value={[posterSize]}
                onValueChange={(value) => {
                  const size = Array.isArray(value) ? value[0] : value;
                  if (size !== undefined)
                    void navigate({
                      to: ".",
                      replace: true,
                      search: (previous) => ({ ...previous, size, density: undefined }),
                    });
                }}
              />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {posterSize}/4
              </span>
            </Field>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="تحديث الأعمال"
            disabled={updating}
            onClick={() => void query.refetch()}
          >
            <RefreshCwIcon data-icon="inline-start" />
          </Button>
        </div>
      </div>
      {selection.isError && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحديد جميع الأعمال</AlertTitle>
          <AlertDescription>
            {selection.error.message}
            <Button variant="outline" size="sm" onClick={() => selection.mutate(criteria)}>
              إعادة المحاولة
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {(selected.size > 0 || selection.isPending) && (
        <div
          role="region"
          aria-label="إجراءات التحديد"
          className="fixed inset-x-3 bottom-4 z-40 mx-auto w-auto max-w-lg rounded-2xl border bg-popover p-3 text-popover-foreground shadow-xl sm:inset-x-6 sm:p-2"
        >
          <div className="flex items-center gap-1">
            <div className="flex size-10 shrink-0 ml-2 items-center justify-center rounded-xl bg-primary">
              <CheckCheckIcon className="size-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div role="status" aria-live="polite" className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {selection.isPending ? "جارٍ تحديد جميع الأعمال…" : `${selected.size} محدد`}
              </p>
              <p className="text-xs leading-6 text-muted-foreground">
                {allSelected
                  ? activeFilters
                    ? "كل الأعمال المطابقة للتصفية"
                    : "المكتبة كاملة"
                  : "تحرير الأعمال المحددة معاً"}
              </p>
            </div>
            {selection.isPending ? (
              <Button size="lg" disabled>
                جارٍ الإعداد…
              </Button>
            ) : (
              <Link
                to="/database/json"
                search={{ ids: [...selected] }}
                className={buttonVariants({ size: "lg" })}
              >
                <BracesIcon data-icon="inline-start" />
                محرر JSON
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="إلغاء التحديد"
              disabled={selection.isPending}
              onClick={clearSelection}
              className="cursor-pointer"
            >
              <XIcon data-icon="inline-start" />
            </Button>
          </div>
        </div>
      )}
      <div className="min-w-0" aria-busy={updating}>
        {query.isPending ? (
          <div className="catalog-gallery">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="aspect-2/3" />
            ))}
          </div>
        ) : query.isError && !query.isFetchNextPageError ? (
          <Alert variant="destructive">
            <AlertTitle>تعذّر تحميل الأعمال</AlertTitle>
            <AlertDescription>
              {query.error.message}
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
              <EmptyDescription>جرّب اسماً آخر أو امسح التصفية.</EmptyDescription>
            </EmptyHeader>
            <Button
              variant="outline"
              onClick={() =>
                filters({
                  q: undefined,
                  structure: undefined,
                  format: undefined,
                  workflow: undefined,
                  visibility: undefined,
                  gap: undefined,
                })
              }
            >
              عرض جميع الأعمال
            </Button>
          </Empty>
        ) : view === "table" ? (
          <WorksTable {...viewProps} />
        ) : view === "list" ? (
          <WorksList {...viewProps} />
        ) : (
          <WorksGallery {...viewProps} size={posterSize} />
        )}
      </div>
      <div ref={loadMoreRef} className="flex flex-col items-center gap-3 py-6">
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {updating ? "جارٍ تحديث النتائج…" : `${items.length} / ${total ?? "…"} عمل`}
        </span>
        {query.isFetchNextPageError ? (
          <Alert variant="destructive">
            <AlertTitle>تعذّر تحميل المزيد</AlertTitle>
            <AlertDescription>
              بقيت الأعمال المحمّلة متاحة.
              <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()}>
                إعادة تحميل المزيد
              </Button>
            </AlertDescription>
          </Alert>
        ) : query.hasNextPage ? (
          <Button variant="ghost" disabled={updating} onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? "جارٍ تحميل المزيد…" : "تحميل المزيد"}
          </Button>
        ) : (
          items.length > 0 && (
            <span className="text-xs text-muted-foreground">وصلت إلى نهاية الأعمال</span>
          )
        )}
      </div>
      {selected.size > 0 && <div className="h-24" aria-hidden="true" />}
    </section>
  );
}
