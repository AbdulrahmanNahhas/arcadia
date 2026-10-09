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
    <div
      ref={row}
      className="home-fitted-row grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-4.5 overflow-visible py-1 max-[520px]:gap-3.5"
    >
      {items.slice(0, columns).map(render)}
    </div>
  );
}
