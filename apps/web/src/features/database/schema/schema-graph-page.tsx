import { cn } from "cn";
import { FocusIcon, MinusIcon, PlusIcon, RotateCcwIcon, WaypointsIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  columnCount,
  headerHeight,
  layoutTables,
  nodeWidth,
  relationshipPath,
  rowHeight,
  schemaEdges,
  schemaTables,
} from "@/features/database/schema/schema-graph-model";
import { SchemaTableDetails } from "@/features/database/schema/schema-table-details";

type Viewport = { x: number; y: number; width: number; height: number };

export function SchemaGraphPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [neighborsOnly, setNeighborsOnly] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; viewport: Viewport } | null>(null);
  const related = useMemo(
    () =>
      new Set(
        schemaEdges.flatMap((edge) =>
          edge.source === selected || edge.target === selected ? [edge.source, edge.target] : [],
        ),
      ),
    [selected],
  );
  const layout = useMemo(
    () =>
      layoutTables(
        schemaTables.filter(
          (table) =>
            !neighborsOnly || !selected || table.name === selected || related.has(table.name),
        ),
      ),
    [neighborsOnly, selected, related],
  );
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [bounds, setBounds] = useState({ width: 900, height: 600 });
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const aspect = bounds && bounds.height ? bounds.width / bounds.height : 1.5;
  const fitWidth = Math.max(layout.width, layout.height * aspect);
  const view = viewport ?? {
    x: (layout.width - fitWidth) / 2,
    y: 0,
    width: fitWidth,
    height: fitWidth / aspect,
  };
  const nodes = new Map(layout.nodes.map((node) => [node.table.name, node]));
  const matches = schemaTables.filter(
    (table) =>
      table.name.includes(search.toLowerCase()) ||
      table.columns.some((column) => column.name.includes(search.toLowerCase())),
  );
  const table = schemaTables.find((item) => item.name === selected);

  function zoom(factor: number) {
    const width = Math.min(20000, Math.max(300, view.width * factor));
    const height = width / aspect;
    setViewport({
      x: view.x + (view.width - width) / 2,
      y: view.y + (view.height - height) / 2,
      width,
      height,
    });
  }
  function selectTable(name: string) {
    setSelected(name);
    const node = nodes.get(name);
    if (node && !neighborsOnly) {
      const height = Math.max(node.height + 120, 700);
      setViewport({
        x: node.x + nodeWidth / 2 - (height * aspect) / 2,
        y: node.y - 60,
        width: height * aspect,
        height,
      });
    } else setViewport(null);
  }

  return (
    <>
      <PageHeader
        title="مخطط العلاقات"
        eyebrow="قاعدة البيانات / المخطط"
        description="كل الجداول والحقول والعلاقات المعلنة في المخطط. اختر جدولاً لتتبع مفاتيحه ومراجعة قيوده."
        actions={
          <>
            <Badge variant="outline">{schemaTables.length} جدولاً</Badge>
            <Badge variant="outline">{columnCount} حقلاً</Badge>
            <Badge variant="outline">{schemaEdges.length} علاقة</Badge>
          </>
        }
      />
      <div className="schema-workspace">
        <aside className="schema-directory" aria-label="دليل الجداول">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="schema-search">البحث في الجداول والحقول</FieldLabel>
              <Input
                id="schema-search"
                dir="ltr"
                placeholder="table / column"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {matches.length} جدولاً · PK أساسي · FK خارجي · ? يقبل الفراغ
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto" dir="ltr">
            {matches.map((item) => (
              <Button
                key={item.name}
                variant={selected === item.name ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => selectTable(item.name)}
              >
                {item.name}
              </Button>
            ))}
            {matches.length === 0 && (
              <p className="text-sm text-muted-foreground" dir="rtl">
                لا توجد جداول مطابقة. جرّب اسم حقل آخر.
              </p>
            )}
          </div>
        </aside>
        <div className="schema-canvas-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <span className="text-xs text-muted-foreground">
              اسحب للتحريك · عجلة الفأرة للتكبير · الأسهم للتحريك
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!selected}
                aria-pressed={neighborsOnly}
                onClick={() => {
                  setNeighborsOnly(!neighborsOnly);
                  setViewport(null);
                }}
              >
                <WaypointsIcon data-icon="inline-start" />
                {neighborsOnly ? "كل الجداول" : "العلاقات المباشرة"}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="تصغير"
                onClick={() => zoom(1.25)}
              >
                <MinusIcon data-icon="inline-start" />
              </Button>
              <span className="font-utility text-xs" dir="ltr">
                {Math.round(((bounds?.width ?? 900) / view.width) * 100)}%
              </span>
              <Button variant="outline" size="icon-sm" aria-label="تكبير" onClick={() => zoom(0.8)}>
                <PlusIcon data-icon="inline-start" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="احتواء المخطط"
                onClick={() => setViewport(null)}
              >
                <FocusIcon data-icon="inline-start" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="إعادة ضبط المخطط"
                onClick={() => {
                  setSelected(null);
                  setSearch("");
                  setNeighborsOnly(false);
                  setViewport(null);
                }}
              >
                <RotateCcwIcon data-icon="inline-start" />
              </Button>
            </div>
          </div>
          <svg
            ref={svgRef}
            className="schema-canvas"
            role="group"
            aria-label="مخطط جداول قاعدة البيانات"
            tabIndex={0}
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            onWheel={(event) => {
              zoom(event.deltaY > 0 ? 1.12 : 0.88);
            }}
            onKeyDown={(event) => {
              const step = view.width / 10;
              if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "0"].includes(
                  event.key,
                )
              )
                event.preventDefault();
              if (event.key === "+") zoom(0.8);
              else if (event.key === "-") zoom(1.25);
              else if (event.key === "0") setViewport(null);
              else if (event.key.startsWith("Arrow"))
                setViewport({
                  ...view,
                  x:
                    view.x +
                    (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
                  y:
                    view.y +
                    (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
                });
            }}
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                (event.target instanceof Element && event.target.closest("[data-table]"))
              )
                return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY, viewport: view };
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const start = drag.current;
              setViewport({
                ...start.viewport,
                x:
                  start.viewport.x -
                  ((event.clientX - start.x) * start.viewport.width) / rect.width,
                y:
                  start.viewport.y -
                  ((event.clientY - start.y) * start.viewport.height) / rect.height,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <defs>
              <pattern id="schema-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" className="schema-dot" />
              </pattern>
              <marker
                id="schema-arrow"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            <rect
              x={view.x}
              y={view.y}
              width={view.width}
              height={view.height}
              fill="url(#schema-dots)"
            />
            {[...schemaEdges]
              .toSorted(
                (a, b) =>
                  Number(a.source === selected || a.target === selected) -
                  Number(b.source === selected || b.target === selected),
              )
              .map((edge) => {
                const source = nodes.get(edge.source);
                const target = nodes.get(edge.target);
                if (!source || !target) return null;
                return (
                  <path
                    key={edge.name}
                    data-relationship={edge.name}
                    className={cn(
                      "schema-edge",
                      selected &&
                        (edge.source === selected || edge.target === selected
                          ? "schema-edge-active"
                          : "schema-edge-muted"),
                    )}
                    d={relationshipPath(source, target, edge.columns, edge.targetColumns)}
                    markerEnd="url(#schema-arrow)"
                  >
                    <title>
                      {edge.source}.{edge.columns.join(", ")} → {edge.target}.
                      {edge.targetColumns.join(", ")} · ON DELETE {edge.onDelete} · ON UPDATE{" "}
                      {edge.onUpdate}
                    </title>
                  </path>
                );
              })}
            {layout.nodes.map((node) => (
              <g
                key={node.table.name}
                data-table={node.table.name}
                className={cn(
                  "schema-node",
                  selected === node.table.name && "schema-node-selected",
                  selected &&
                    !related.has(node.table.name) &&
                    selected !== node.table.name &&
                    "schema-node-muted",
                )}
                transform={`translate(${node.x} ${node.y})`}
                role="button"
                aria-label={`جدول ${node.table.name}`}
                aria-pressed={selected === node.table.name}
                tabIndex={0}
                onClick={() => selectTable(node.table.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    selectTable(node.table.name);
                  }
                }}
              >
                <rect width={nodeWidth} height={node.height} rx="10" className="schema-node-body" />
                <rect
                  width={nodeWidth}
                  height={headerHeight}
                  rx="10"
                  className="schema-node-header"
                />
                <text x="16" y="30" className="schema-node-title">
                  {node.table.name}
                </text>
                {node.table.columns.map((column, index) => (
                  <g
                    key={column.name}
                    transform={`translate(0 ${headerHeight + index * rowHeight})`}
                  >
                    <title>
                      {column.name}: {column.type}
                      {column.nullable ? " NULL" : " NOT NULL"}
                      {column.default ? ` DEFAULT ${column.default}` : ""}
                    </title>
                    <text x="14" y="18" className="schema-key">
                      {column.primary
                        ? "PK"
                        : node.table.foreignKeys.some((key) => key.columns.includes(column.name))
                          ? "FK"
                          : ""}
                    </text>
                    <text x="44" y="18" className="schema-column">
                      {column.name}
                      {column.nullable ? "?" : ""}
                    </text>
                    <text x={nodeWidth - 14} y="18" textAnchor="end" className="schema-type">
                      {column.type.length > 16 ? `${column.type.slice(0, 15)}…` : column.type}
                    </text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
          <div className="flex flex-wrap justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span dir="ltr">FK → referenced key</span>
            <span>المخطط المحفوظ من تعريف قاعدة البيانات · لا يتضمن سجلات خاصة</span>
          </div>
        </div>
      </div>
      {table && <SchemaTableDetails table={table} onSelect={selectTable} />}
    </>
  );
}
