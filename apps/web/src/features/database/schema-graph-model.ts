import schema from "./schema-graph.json";

export type SchemaTable = (typeof schema)[number];
export const schemaTables = schema;
export const nodeWidth = 380;
export const rowHeight = 26;
export const headerHeight = 48;
export const schemaEdges = schema.flatMap((table) =>
  table.foreignKeys.map((key) => ({ ...key, source: table.name })),
);
export const columnCount = schema.reduce((sum, table) => sum + table.columns.length, 0);

export function layoutTables(tables: SchemaTable[]) {
  const lanes = Array.from(
    { length: Math.min(6, Math.max(1, Math.ceil(Math.sqrt(tables.length)))) },
    () => 40,
  );
  const nodes = tables.map((table) => {
    const lane = lanes.indexOf(Math.min(...lanes));
    const height = headerHeight + table.columns.length * rowHeight + 16;
    const node = { table, x: 40 + lane * (nodeWidth + 120), y: lanes[lane] ?? 40, height };
    lanes[lane] = node.y + height + 100;
    return node;
  });
  return { nodes, width: lanes.length * (nodeWidth + 120), height: Math.max(...lanes) };
}

export type GraphNode = ReturnType<typeof layoutTables>["nodes"][number];
export function relationshipPath(
  source: GraphNode,
  target: GraphNode,
  columns: string[],
  targetColumns: string[],
) {
  const sourceRow = source.table.columns.findIndex((column) => column.name === columns[0]);
  const targetRow = target.table.columns.findIndex((column) => column.name === targetColumns[0]);
  const sy = source.y + headerHeight + sourceRow * rowHeight + rowHeight / 2;
  const ty = target.y + headerHeight + targetRow * rowHeight + rowHeight / 2;
  const right = target.x > source.x;
  const sx = source.x + (right || source === target ? nodeWidth : 0);
  const tx = target.x + (right ? 0 : nodeWidth);
  if (source === target) return `M ${sx} ${sy} C ${sx + 80} ${sy}, ${sx + 80} ${ty}, ${tx} ${ty}`;
  const bend = Math.max(60, Math.abs(tx - sx) / 2);
  const direction = right ? 1 : -1;
  return `M ${sx} ${sy} C ${sx + bend * direction} ${sy}, ${tx - bend * direction} ${ty}, ${tx} ${ty}`;
}
