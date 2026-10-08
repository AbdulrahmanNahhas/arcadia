export function withPositions<T extends { position?: number }>(rows: readonly T[]): T[] {
  return rows.map((row, position) => ({ ...row, position }));
}
export function moveOrderedRow<T extends { position?: number }>(
  rows: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return [...rows];
  const result = [...rows];
  const [item] = result.splice(index, 1);
  if (!item) return result;
  result.splice(target, 0, item);
  return withPositions(result);
}
