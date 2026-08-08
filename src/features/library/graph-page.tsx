import {
  ArrowsOutSimpleIcon,
  FunnelSimpleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  MapTrifoldIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { PointerEvent as ReactPointerEvent, WheelEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getWorks, setWorkFavorite } from "@/server/library.functions";
import { WorkArtwork } from "./components/work-artwork";
import { WorkDetailDialog } from "./components/work-detail-dialog";
import { AdvancedFilter } from "./filter-sheet";
import type { WorkFilterState } from "./filtering";
import { buildFacetOptions, createDefaultFilters, workMatchesFilters } from "./filtering";
import type { Work } from "./model";
import { useArabicTranslations } from "./translations";

type Point = { x: number; y: number };

type GraphNode = Point & {
  work: Work;
  cluster: string;
  clusterLabel: string;
};

const boardSize = 3_200;
const minZoom = 0.55;
const maxZoom = 1.35;

export function GraphPage() {
  const queryClient = useQueryClient();
  const { taxonomyLabel } = useArabicTranslations();
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const [filters, setFilters] = useState<WorkFilterState>(() => createDefaultFilters());
  const [selectedWorkId, setSelectedWorkId] = useState<string>();
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; origin: Point; pan: Point } | undefined>(undefined);

  const facetOptions = useMemo(() => buildFacetOptions(works), [works]);
  const visibleWorks = useMemo(
    () => works.filter((work) => workMatchesFilters(work, filters)),
    [filters, works],
  );
  const nodes = useMemo(
    () => buildGraphNodes(visibleWorks, (genre) => taxonomyLabel("genre", genre)),
    [taxonomyLabel, visibleWorks],
  );
  const selectedWork = works.find((work) => work.id === selectedWorkId) ?? null;
  const favoriteMutation = useMutation({
    mutationFn: setWorkFavorite,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["works"] }),
  });

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      pan,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setPan({
      x: drag.current.pan.x + event.clientX - drag.current.origin.x,
      y: drag.current.pan.y + event.clientY - drag.current.origin.y,
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = undefined;
  };

  const zoomBy = (amount: number) =>
    setZoom((current) => clamp(current + amount, minZoom, maxZoom));
  const resetView = () => {
    setZoom(0.9);
    setPan({ x: 0, y: 0 });
  };
  const toggleComparison = (workId: string) => {
    setComparisonIds((current) =>
      current.includes(workId)
        ? current.filter((id) => id !== workId)
        : [...current, workId].slice(-6),
    );
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <section
        className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-size-[22px_22px] active:cursor-grabbing"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(event) => handleWheel(event, zoomBy)}
        aria-label="خريطة الأعمال. اسحب المساحة للتنقل."
      >
        <div
          className="absolute top-1/2 left-1/2 origin-center transition-transform duration-150 motion-reduce:transition-none"
          style={{
            width: boardSize,
            height: boardSize,
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-52 rounded-full border border-primary/10"
          />
          <div
            aria-hidden="true"
            className="absolute inset-96 rounded-full border border-border/70"
          />
          {nodes.map((node) => (
            <GraphPoster
              key={node.work.id}
              node={node}
              onOpen={() => setSelectedWorkId(node.work.id)}
            />
          ))}
          {nodes.length === 0 && (
            <p className="absolute top-1/2 left-1/2 w-80 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
              لا توجد أعمال تطابق الفلاتر الحالية.
            </p>
          )}
        </div>
      </section>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-3 sm:p-5">
        <div className="pointer-events-auto flex items-start justify-between gap-3">
          <div className="rounded-2xl border bg-background/90 px-4 py-3 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MapTrifoldIcon />
              خريطة المكتبة
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.035em] sm:text-2xl">
              العوالم المتجاورة
            </h1>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              تتجاور الأعمال ذات التصنيف المتشابه؛ اسحب لاستكشاف مكتبتك.
            </p>
          </div>
          <Link
            to="/library"
            search={{}}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "bg-background/90 shadow-sm backdrop-blur-xl",
            )}
          >
            العودة للمكتبة
          </Link>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <AdvancedFilter
            filters={filters}
            facetOptions={facetOptions}
            onChange={setFilters}
            matchingCount={visibleWorks.length}
            title="فلترة خريطة المكتبة"
            triggerLabel="فلترة الخريطة"
          />
          <Badge
            variant="secondary"
            className="h-8 bg-background/90 px-3 shadow-sm backdrop-blur-xl"
          >
            {new Intl.NumberFormat("ar").format(visibleWorks.length)} عمل
          </Badge>
          <Badge
            variant="outline"
            className="hidden h-8 bg-background/90 px-3 shadow-sm backdrop-blur-xl sm:inline-flex"
          >
            {new Set(nodes.map((node) => node.cluster)).size} مجموعات
          </Badge>
        </div>
      </header>

      <aside
        className="absolute right-3 bottom-3 flex flex-col gap-1 rounded-2xl border bg-background/90 p-1.5 shadow-sm backdrop-blur-xl sm:right-5 sm:bottom-5"
        aria-label="التحكم بالخريطة"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => zoomBy(0.1)}
          aria-label="تكبير الخريطة"
          title="تكبير"
        >
          <MagnifyingGlassPlusIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => zoomBy(-0.1)}
          aria-label="تصغير الخريطة"
          title="تصغير"
        >
          <MagnifyingGlassMinusIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={resetView}
          aria-label="إعادة توسيط الخريطة"
          title="إعادة التوسيط"
        >
          <ArrowsOutSimpleIcon />
        </Button>
      </aside>

      <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-xl bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-xl sm:block">
        <FunnelSimpleIcon className="ml-1 inline" /> الفلاتر تطبّق فوراً على الخريطة
      </div>

      <WorkDetailDialog
        work={selectedWork}
        open={Boolean(selectedWork)}
        onOpenChange={(open) => !open && setSelectedWorkId(undefined)}
        toggleFavorite={(work) =>
          favoriteMutation.mutate({ data: { workId: work.id, favorite: !work.favorite } })
        }
        favoritePending={favoriteMutation.isPending}
        openRelated={setSelectedWorkId}
        comparisonIds={comparisonIds}
        toggleComparison={toggleComparison}
      />
    </div>
  );
}

function GraphPoster({ node, onOpen }: { node: GraphNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="group/graph absolute w-28 cursor-pointer text-right outline-none transition-transform duration-200 hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 motion-reduce:transition-none"
      style={{ left: node.x, top: node.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onOpen}
      aria-label={`فتح تفاصيل ${node.work.arabicTitle || node.work.title}`}
    >
      <WorkArtwork
        work={node.work}
        showType={false}
        compact
        className="shadow-lg shadow-black/15 ring-1 ring-background"
      />
      <span className="mt-1.5 block truncate text-center text-xs font-medium text-foreground drop-shadow-sm">
        {node.work.arabicTitle || node.work.title}
      </span>
      <span className="mt-0.5 block truncate text-center text-[10px] text-muted-foreground">
        {node.clusterLabel}
      </span>
    </button>
  );
}

export function buildGraphNodes(works: Work[], labelGenre: (genre: string) => string): GraphNode[] {
  const groups = new Map<string, Work[]>();
  for (const work of works) {
    const cluster = work.genres[0] ? `genre:${work.genres[0]}` : `kind:${work.kind}`;
    groups.set(cluster, [...(groups.get(cluster) ?? []), work]);
  }

  return [...groups.entries()].flatMap(([cluster, clusterWorks], clusterIndex) => {
    const center = {
      x: 420 + (clusterIndex % 4) * 780,
      y: 420 + Math.floor(clusterIndex / 4) * 720,
    };
    const clusterLabel = cluster.startsWith("genre:") ? labelGenre(cluster.slice(6)) : "نوع متشابه";
    return [...clusterWorks]
      .sort((left, right) => stableHash(left.id) - stableHash(right.id))
      .map((work, index) => {
        const angle =
          (Math.PI * 2 * index) / Math.max(clusterWorks.length, 1) + stableHash(work.id) / 100;
        const radius = clusterWorks.length === 1 ? 0 : 120 + (index % 3) * 58;
        return {
          work,
          cluster,
          clusterLabel,
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
      });
  });
}

function handleWheel(event: WheelEvent<HTMLElement>, zoomBy: (amount: number) => void) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  zoomBy(event.deltaY > 0 ? -0.08 : 0.08);
}

function stableHash(value: string) {
  return [...value].reduce(
    (hash, character) => ((hash * 31 + character.charCodeAt(0)) >>> 0) % 1_000,
    0,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
