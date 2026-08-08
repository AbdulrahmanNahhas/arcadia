import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsOutSimpleIcon,
  BuildingsIcon,
  GitBranchIcon,
  MagnifyingGlassIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  SquaresFourIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { PointerEvent as ReactPointerEvent, WheelEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Entity } from "@/features/library/model";
import type { OrganizationRelationship } from "@/features/platform/model";
import { cn } from "@/lib/utils";
import { getStudioLineage } from "@/server/platform.functions";
import { EntityDialog } from "./components/entity-dialog";
import { PlatformShell } from "./components/platform-shell";

type Point = { x: number; y: number };
type GraphNode = Point & { entity: Entity; degree: number };
type GraphEdge = {
  relationship: OrganizationRelationship;
  source: GraphNode;
  target: GraphNode;
};
type GraphFamily = Point & { id: number; label: string; nodeIds: string[] };
type LayoutMode = "organic" | "flow";

const board = { width: 2_600, height: 1_800 };
const minZoom = 0.45;
const maxZoom = 1.35;

export function StudioLineagePage() {
  const { data: relationships } = useSuspenseQuery({
    queryKey: ["studio-lineage"],
    queryFn: () => getStudioLineage(),
  });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState<Point>({ x: 0, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("organic");
  const [familyIndex, setFamilyIndex] = useState(0);
  const drag = useRef<{ pointerId: number; origin: Point; pan: Point } | null>(null);
  const types = useMemo(
    () => [...new Map(relationships.map((item) => [item.type.id, item.type])).values()],
    [relationships],
  );
  const visibleRelationships = useMemo(
    () => relationships.filter((relationship) => type === "all" || relationship.type.id === type),
    [relationships, type],
  );
  const graph = useMemo(
    () => buildLineageGraph(visibleRelationships, layoutMode),
    [layoutMode, visibleRelationships],
  );
  const activeFamilyIndex = Math.min(familyIndex, Math.max(0, graph.families.length - 1));
  const activeFamily = graph.families[activeFamilyIndex];
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matchingIds = useMemo(() => {
    if (!normalizedSearch) return new Set<string>();
    return new Set(
      graph.nodes
        .filter((node) =>
          [node.entity.name, node.entity.sortName, ...node.entity.alternativeNames]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedSearch),
        )
        .map((node) => node.entity.id),
    );
  }, [graph.nodes, normalizedSearch]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      pan,
    };
    setIsDragging(true);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setPan({
      x: drag.current.pan.x + event.clientX - drag.current.origin.x,
      y: drag.current.pan.y + event.clientY - drag.current.origin.y,
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
      setIsDragging(false);
    }
  };
  const zoomBy = (amount: number) =>
    setZoom((current) => clamp(current + amount, minZoom, maxZoom));
  const resetView = () => {
    setZoom(0.72);
    setPan({ x: 0, y: 30 });
  };
  const focusFamily = (index: number) => {
    const family = graph.families[index];
    if (!family) return;
    setFamilyIndex(index);
    setPan({
      x: (board.width / 2 - family.x) * zoom,
      y: (board.height / 2 - family.y) * zoom,
    });
  };
  const moveFamily = (direction: -1 | 1) => {
    if (!graph.families.length) return;
    focusFamily((activeFamilyIndex + direction + graph.families.length) % graph.families.length);
  };
  const changeLayout = (mode: LayoutMode) => {
    setLayoutMode(mode);
    setFamilyIndex(0);
    setPan({ x: 0, y: 30 });
  };

  return (
    <PlatformShell immersive>
      <div className="relative h-svh overflow-hidden bg-background">
        {graph.nodes.length ? (
          <section
            className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--border)_55%,transparent)_1px,transparent_0)] bg-size-[28px_28px] active:cursor-grabbing"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={(event) => handleWheel(event, zoomBy)}
            aria-label="خريطة علاقات الاستوديوهات. اسحب المساحة للتنقل، واضغط على أي استوديو لفتح تفاصيله."
          >
            <div
              className={cn(
                "absolute top-1/2 left-1/2 origin-center will-change-transform motion-reduce:transition-none",
                !isDragging && "transition-transform duration-500 ease-out",
              )}
              style={{
                width: board.width,
                height: board.height,
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <div
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 size-220 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/8"
              />
              <div
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 size-320 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/35"
              />
              <svg
                aria-hidden="true"
                viewBox={`0 0 ${board.width} ${board.height}`}
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
              >
                <defs>
                  <marker
                    id="lineage-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
                  </marker>
                </defs>
                {graph.edges.map((edge) => {
                  const geometry = edgeGeometry(edge);
                  return (
                    <path
                      key={edge.relationship.id}
                      d={geometry.path}
                      fill="none"
                      markerEnd={
                        edge.relationship.type.isDirected ? "url(#lineage-arrow)" : undefined
                      }
                      className={cn(
                        "stroke-border/80 stroke-[2.5]",
                        edge.relationship.type.category === "corporate" && "stroke-primary/65",
                        edge.relationship.type.category === "creative" &&
                          "stroke-foreground/55 stroke-2 [stroke-dasharray:8_8]",
                        normalizedSearch &&
                          !matchingIds.has(edge.source.entity.id) &&
                          !matchingIds.has(edge.target.entity.id) &&
                          "opacity-15",
                      )}
                    />
                  );
                })}
              </svg>

              {graph.edges.map((edge) => (
                <RelationshipLabel
                  key={edge.relationship.id}
                  edge={edge}
                  dimmed={
                    Boolean(normalizedSearch) &&
                    !matchingIds.has(edge.source.entity.id) &&
                    !matchingIds.has(edge.target.entity.id)
                  }
                />
              ))}
              {graph.nodes.map((node) => (
                <StudioNode
                  key={node.entity.id}
                  node={node}
                  dimmed={Boolean(normalizedSearch) && !matchingIds.has(node.entity.id)}
                  matched={Boolean(normalizedSearch) && matchingIds.has(node.entity.id)}
                />
              ))}
            </div>
          </section>
        ) : (
          <Empty className="absolute inset-5 top-24 border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TreeStructureIcon />
              </EmptyMedia>
              <EmptyTitle>
                {relationships.length ? "لا توجد علاقات من هذا النوع" : "الخريطة جاهزة للبيانات"}
              </EmptyTitle>
              <EmptyDescription>
                {relationships.length
                  ? "اختر نوعاً آخر من قائمة العلاقات."
                  : "أضف علاقات موثقة من لوحة الإدارة لتظهر هنا كخريطة مترابطة."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <header className="pointer-events-none absolute inset-x-0 top-18 px-4 sm:px-6">
          <div className="mx-auto flex max-w-400 items-start">
            {showPanel ? (
              <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border/70 bg-background/88 p-3 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] tracking-[0.18em] text-primary">
                      خريطة المعرفة المؤسسية
                    </p>
                    <h1 className="mt-0.5 font-heading text-xl font-semibold tracking-tight">
                      سلالات الاستوديوهات
                    </h1>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPanel(false)}
                    aria-label="إخفاء أدوات الخريطة"
                    title="إخفاء الأدوات"
                  >
                    <ArrowRightIcon />
                  </Button>
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="ابحث عن استوديو…"
                      className="w-full bg-background/60 pe-9"
                    />
                  </div>
                  <Select value={type} onValueChange={(value) => setType(value ?? "all")}>
                    <SelectTrigger className="w-36 bg-background/60">
                      <SelectValue placeholder="العلاقات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">كل العلاقات</SelectItem>
                        {types.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nameAr}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant={layoutMode === "flow" ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeLayout("flow")}
                  >
                    <GitBranchIcon data-icon="inline-start" /> ترتيب حسب الأسهم
                  </Button>
                  <Button
                    variant={layoutMode === "organic" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => changeLayout("organic")}
                  >
                    <SquaresFourIcon data-icon="inline-start" /> الخريطة الحرة
                  </Button>
                  <Badge variant="outline" className="ms-auto">
                    {graph.nodes.length}
                  </Badge>
                </div>
                {normalizedSearch ? (
                  <p className="mt-2 font-mono text-[9px] text-muted-foreground">
                    {matchingIds.size ? `${matchingIds.size} نتيجة مضاءة` : "لا توجد نتيجة مطابقة."}
                  </p>
                ) : null}
              </div>
            ) : (
              <Button
                className="pointer-events-auto shadow-xl"
                variant="secondary"
                onClick={() => setShowPanel(true)}
              >
                <TreeStructureIcon data-icon="inline-start" /> أدوات الخريطة
              </Button>
            )}
          </div>
        </header>

        {activeFamily && graph.families.length > 1 ? (
          <nav
            className="absolute bottom-22 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/70 bg-background/88 p-1.5 shadow-xl backdrop-blur-xl sm:bottom-6"
            aria-label="التنقل بين عائلات العلاقات"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => moveFamily(-1)}
              aria-label="العائلة السابقة"
            >
              <ArrowRightIcon />
            </Button>
            <button
              type="button"
              className="min-w-32 rounded-full px-3 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => focusFamily(activeFamilyIndex)}
            >
              <strong className="block truncate text-xs">{activeFamily.label}</strong>
              <span className="block font-mono text-[9px] text-muted-foreground">
                {activeFamilyIndex + 1} / {graph.families.length} · {activeFamily.nodeIds.length}{" "}
                عقد
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => moveFamily(1)}
              aria-label="العائلة التالية"
            >
              <ArrowLeftIcon />
            </Button>
          </nav>
        ) : null}

        <aside
          className="absolute inset-e-4 bottom-22 flex flex-col gap-1 rounded-2xl border border-border/70 bg-background/88 p-1.5 shadow-xl backdrop-blur-xl sm:inset-e-6 sm:bottom-6"
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

        <div className="pointer-events-none absolute bottom-6 inset-s-6 hidden items-center gap-4 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-[10px] text-muted-foreground shadow-lg backdrop-blur-xl lg:flex">
          <LegendDot className="bg-primary" label="مؤسسي" />
          <LegendDot className="bg-foreground/60" label="تاريخي" />
          <span className="flex items-center gap-2">
            <span className="h-px w-5 border-t border-dashed border-foreground/60" /> إبداعي
          </span>
        </div>
      </div>
    </PlatformShell>
  );
}

function StudioNode({
  node,
  dimmed,
  matched,
}: {
  node: GraphNode;
  dimmed: boolean;
  matched: boolean;
}) {
  return (
    <EntityDialog
      entity={node.entity}
      triggerClassName={cn(
        "group absolute w-38 -translate-x-1/2 -translate-y-1/2 rounded-3xl text-center outline-none transition duration-300 hover:z-20 hover:scale-105 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transition-none",
        dimmed && "opacity-20 grayscale",
        matched && "z-10 scale-105",
      )}
      triggerStyle={{ left: node.x, top: node.y }}
    >
      <span className="block w-38" onPointerDown={(event) => event.stopPropagation()}>
        <span
          className={cn(
            "relative mx-auto flex size-25 items-center justify-center overflow-hidden rounded-3xl border border-border bg-card p-0 shadow-2xl transition-colors group-hover:border-primary/60",
            matched && "border-primary ring-4 ring-primary/15",
          )}
        >
          {node.entity.imagePath ? (
            <img
              src={node.entity.imagePath}
              alt=""
              className="size-full object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <BuildingsIcon className="text-muted-foreground" size={38} />
          )}
          <span className="absolute inset-e-1.5 bottom-1.5 flex size-5 items-center justify-center rounded-full border border-background bg-primary font-mono text-[9px] text-primary-foreground">
            {node.degree}
          </span>
        </span>
        <strong className="mt-2 block truncate font-heading text-sm font-semibold drop-shadow-md">
          {node.entity.name}
        </strong>
        <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
          {node.entity.establishedAt?.slice(0, 4) || `${node.entity.workCount} أعمال`}
        </span>
      </span>
    </EntityDialog>
  );
}

function RelationshipLabel({ edge, dimmed }: { edge: GraphEdge; dimmed: boolean }) {
  const geometry = edgeGeometry(edge);
  return (
    <div
      className={cn(
        "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-opacity",
        dimmed && "opacity-15",
      )}
      style={{ left: geometry.label.x, top: geometry.label.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Badge variant={relationshipBadgeVariant(edge.relationship)} className="shadow-lg">
        {edge.relationship.type.nameAr}
        {edge.relationship.occurredOn ? ` · ${edge.relationship.occurredOn.slice(0, 4)}` : ""}
      </Badge>
      {edge.relationship.people.length ? (
        <div className="flex gap-1 rounded-full border border-border/60 bg-background/80 p-1 shadow-lg backdrop-blur-sm">
          {edge.relationship.people.slice(0, 3).map(({ entity }) => (
            <EntityDialog
              key={entity.id}
              entity={entity}
              triggerClassName="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-muted font-mono text-[8px]">
                {entity.imagePath ? (
                  <img src={entity.imagePath} alt="" className="size-full object-cover" />
                ) : (
                  entity.name.slice(0, 1)
                )}
              </span>
            </EntityDialog>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("size-1.5 rounded-full", className)} /> {label}
    </span>
  );
}

function relationshipBadgeVariant(
  relationship: OrganizationRelationship,
): "default" | "secondary" | "outline" {
  if (relationship.type.category === "corporate") return "default";
  if (relationship.type.category === "creative") return "secondary";
  return "outline";
}

function buildLineageGraph(
  relationships: OrganizationRelationship[],
  layoutMode: LayoutMode,
): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  families: GraphFamily[];
} {
  const entities = new Map<string, Entity>();
  const adjacency = new Map<string, Set<string>>();
  for (const relationship of relationships) {
    entities.set(relationship.source.id, relationship.source);
    entities.set(relationship.target.id, relationship.target);
    const sourceNeighbors = adjacency.get(relationship.source.id) ?? new Set<string>();
    const targetNeighbors = adjacency.get(relationship.target.id) ?? new Set<string>();
    sourceNeighbors.add(relationship.target.id);
    targetNeighbors.add(relationship.source.id);
    adjacency.set(relationship.source.id, sourceNeighbors);
    adjacency.set(relationship.target.id, targetNeighbors);
  }

  const entityIds = [...entities.keys()].sort();
  const componentById = connectedComponents(entityIds, adjacency);
  const componentCount = Math.max(1, new Set(componentById.values()).size);
  const columns = Math.ceil(Math.sqrt(componentCount));
  const rows = Math.ceil(componentCount / columns);
  const componentCenters = new Map<number, Point>();
  for (let index = 0; index < componentCount; index += 1) {
    componentCenters.set(index, {
      x: ((index % columns) + 0.5) * (board.width / columns),
      y: (Math.floor(index / columns) + 0.5) * (board.height / rows),
    });
  }

  const positions =
    layoutMode === "flow"
      ? buildFlowPositions(entityIds, relationships, componentById, componentCenters)
      : buildOrganicPositions(entityIds, relationships, componentById, componentCenters);
  const nodes = entityIds.flatMap((id): GraphNode[] => {
    const entity = entities.get(id);
    const position = positions.get(id);
    return entity && position
      ? [{ entity, degree: adjacency.get(id)?.size ?? 0, ...position }]
      : [];
  });
  const nodeById = new Map(nodes.map((node) => [node.entity.id, node]));
  const edges = relationships.flatMap((relationship): GraphEdge[] => {
    const source = nodeById.get(relationship.source.id);
    const target = nodeById.get(relationship.target.id);
    return source && target ? [{ relationship, source, target }] : [];
  });
  const families = [...new Set(componentById.values())].map((component): GraphFamily => {
    const familyNodes = nodes.filter((node) => componentById.get(node.entity.id) === component);
    const hub = [...familyNodes].sort(
      (left, right) =>
        right.degree - left.degree || left.entity.name.localeCompare(right.entity.name),
    )[0];
    return {
      id: component,
      label: hub?.entity.name ?? "عائلة مستقلة",
      nodeIds: familyNodes.map((node) => node.entity.id),
      x: familyNodes.reduce((total, node) => total + node.x, 0) / Math.max(1, familyNodes.length),
      y: familyNodes.reduce((total, node) => total + node.y, 0) / Math.max(1, familyNodes.length),
    };
  });
  return { nodes, edges, families };
}

function buildOrganicPositions(
  entityIds: string[],
  relationships: OrganizationRelationship[],
  componentById: Map<string, number>,
  componentCenters: Map<number, Point>,
) {
  const positions = new Map<string, Point>();
  for (const [index, id] of entityIds.entries()) {
    const center = componentCenters.get(componentById.get(id) ?? 0) ?? {
      x: board.width / 2,
      y: board.height / 2,
    };
    const angle = (stableHash(id) / 1_000) * Math.PI * 2 + index * 0.7;
    const radius = 110 + (stableHash(`${id}:radius`) % 280);
    positions.set(id, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }

  for (let iteration = 0; iteration < 180; iteration += 1) {
    const movement = new Map(entityIds.map((id) => [id, { x: 0, y: 0 }]));
    for (let leftIndex = 0; leftIndex < entityIds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < entityIds.length; rightIndex += 1) {
        const leftId = entityIds[leftIndex];
        const rightId = entityIds[rightIndex];
        const left = positions.get(leftId);
        const right = positions.get(rightId);
        if (!left || !right) continue;
        const deltaX = left.x - right.x || 0.1;
        const deltaY = left.y - right.y || 0.1;
        const distance = Math.max(40, Math.hypot(deltaX, deltaY));
        const force = Math.min(18, 72_000 / (distance * distance));
        const offset = { x: (deltaX / distance) * force, y: (deltaY / distance) * force };
        const leftMovement = movement.get(leftId);
        const rightMovement = movement.get(rightId);
        if (leftMovement) {
          leftMovement.x += offset.x;
          leftMovement.y += offset.y;
        }
        if (rightMovement) {
          rightMovement.x -= offset.x;
          rightMovement.y -= offset.y;
        }
      }
    }
    for (const relationship of relationships) {
      const source = positions.get(relationship.source.id);
      const target = positions.get(relationship.target.id);
      if (!source || !target) continue;
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const force = (distance - 330) * 0.018;
      const offset = { x: (deltaX / distance) * force, y: (deltaY / distance) * force };
      const sourceMovement = movement.get(relationship.source.id);
      const targetMovement = movement.get(relationship.target.id);
      if (sourceMovement) {
        sourceMovement.x += offset.x;
        sourceMovement.y += offset.y;
      }
      if (targetMovement) {
        targetMovement.x -= offset.x;
        targetMovement.y -= offset.y;
      }
    }
    for (const id of entityIds) {
      const position = positions.get(id);
      const offset = movement.get(id);
      const center = componentCenters.get(componentById.get(id) ?? 0);
      if (!position || !offset || !center) continue;
      offset.x += (center.x - position.x) * 0.003;
      offset.y += (center.y - position.y) * 0.003;
      positions.set(id, {
        x: clamp(position.x + offset.x, 150, board.width - 150),
        y: clamp(position.y + offset.y, 160, board.height - 160),
      });
    }
  }
  return positions;
}

function buildFlowPositions(
  entityIds: string[],
  relationships: OrganizationRelationship[],
  componentById: Map<string, number>,
  componentCenters: Map<number, Point>,
) {
  const positions = new Map<string, Point>();
  for (const component of new Set(componentById.values())) {
    const ids = entityIds.filter((id) => componentById.get(id) === component);
    const level = new Map(ids.map((id) => [id, 0]));
    const incoming = new Map(ids.map((id) => [id, 0]));
    for (const relationship of relationships) {
      if (
        !relationship.type.isDirected ||
        componentById.get(relationship.source.id) !== component
      ) {
        continue;
      }
      incoming.set(relationship.target.id, (incoming.get(relationship.target.id) ?? 0) + 1);
    }
    const pending = ids.filter((id) => (incoming.get(id) ?? 0) === 0);
    const visited = new Set<string>();
    while (pending.length) {
      const sourceId = pending.shift();
      if (!sourceId || visited.has(sourceId)) continue;
      visited.add(sourceId);
      for (const relationship of relationships) {
        if (!relationship.type.isDirected || relationship.source.id !== sourceId) continue;
        level.set(
          relationship.target.id,
          Math.max(level.get(relationship.target.id) ?? 0, (level.get(sourceId) ?? 0) + 1),
        );
        incoming.set(relationship.target.id, (incoming.get(relationship.target.id) ?? 1) - 1);
        if ((incoming.get(relationship.target.id) ?? 0) <= 0) pending.push(relationship.target.id);
      }
    }
    const center = componentCenters.get(component) ?? { x: board.width / 2, y: board.height / 2 };
    const maxLevel = Math.max(0, ...level.values());
    const groups = new Map<number, string[]>();
    for (const id of ids) {
      const itemLevel = level.get(id) ?? 0;
      groups.set(itemLevel, [...(groups.get(itemLevel) ?? []), id]);
    }
    for (const [itemLevel, levelIds] of groups) {
      const sortedIds = [...levelIds].sort((left, right) => stableHash(left) - stableHash(right));
      sortedIds.forEach((id, index) => {
        positions.set(id, {
          x: clamp(center.x + (maxLevel / 2 - itemLevel) * 390, 150, board.width - 150),
          y: clamp(center.y + (index - (sortedIds.length - 1) / 2) * 220, 160, board.height - 160),
        });
      });
    }
  }
  return positions;
}

function connectedComponents(ids: string[], adjacency: Map<string, Set<string>>) {
  const componentById = new Map<string, number>();
  let component = 0;
  for (const id of ids) {
    if (componentById.has(id)) continue;
    const pending = [id];
    while (pending.length) {
      const current = pending.pop();
      if (!current || componentById.has(current)) continue;
      componentById.set(current, component);
      pending.push(...(adjacency.get(current) ?? []));
    }
    component += 1;
  }
  return componentById;
}

function edgeGeometry(edge: GraphEdge) {
  const deltaX = edge.target.x - edge.source.x;
  const deltaY = edge.target.y - edge.source.y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const normal = { x: -deltaY / distance, y: deltaX / distance };
  const curve = ((stableHash(edge.relationship.id) % 3) - 1) * 54;
  const source = {
    x: edge.source.x + (deltaX / distance) * 76,
    y: edge.source.y + (deltaY / distance) * 76,
  };
  const target = {
    x: edge.target.x - (deltaX / distance) * 84,
    y: edge.target.y - (deltaY / distance) * 84,
  };
  const control = {
    x: (source.x + target.x) / 2 + normal.x * curve,
    y: (source.y + target.y) / 2 + normal.y * curve,
  };
  return {
    path: `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`,
    label: {
      x: source.x * 0.25 + control.x * 0.5 + target.x * 0.25,
      y: source.y * 0.25 + control.y * 0.5 + target.y * 0.25,
    },
  };
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
