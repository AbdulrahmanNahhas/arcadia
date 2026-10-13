import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../../components/ui/button";

/** Whole cards per page; every loaded item remains reachable at any viewport width. */
export function FittedRow<T>({
  items,
  render,
  layout = "poster",
}: {
  items: T[];
  render: (item: T) => ReactNode;
  layout?: "poster" | "banner";
}) {
  const row = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!row.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setColumns(
        Math.max(1, Math.floor((entry.contentRect.width + 16) / (layout === "banner" ? 296 : 176))),
      ),
    );
    observer.observe(row.current);
    return () => observer.disconnect();
  }, [layout]);
  const pages = Math.max(1, Math.ceil(items.length / columns));
  const current = Math.min(page, pages - 1);
  return (
    <div>
      <div
        ref={row}
        className={cn(
          "home-fitted-row grid gap-4 py-1",
          layout === "banner"
            ? "grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))]"
            : "grid-cols-[repeat(auto-fill,minmax(min(160px,100%),1fr))]",
        )}
      >
        {items.slice(current * columns, (current + 1) * columns).map(render)}
      </div>
      {pages > 1 && (
        <div
          className="mt-3 flex items-center justify-end gap-2"
          aria-label="التنقل بين بطاقات القسم"
        >
          <span className="me-2 text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {current + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="البطاقات السابقة"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="البطاقات التالية"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronLeft />
          </Button>
        </div>
      )}
    </div>
  );
}
