import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
/** A fitted row, without clipped horizontal scrolling or measuring every card. */
export function FittedRow<T>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    if (!row.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setColumns(Math.max(1, Math.floor((entry.contentRect.width + 18) / 163))),
    );
    observer.observe(row.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={row} className="home-fitted-row">
      {items.slice(0, columns).map(render)}
    </div>
  );
}
