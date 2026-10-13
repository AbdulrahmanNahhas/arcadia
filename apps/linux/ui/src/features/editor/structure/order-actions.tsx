import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function OrderActions({
  label,
  index,
  count,
  onMove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`ترتيب ${label}`}>
      <span
        className="px-1 text-xs tabular-nums text-muted-foreground"
        aria-label={`الترتيب ${index + 1}`}
      >
        {index + 1}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === 0}
        aria-label={`رفع ${label}`}
        onClick={() => onMove(-1)}
      >
        <ArrowUpIcon data-icon="inline-start" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index + 1 === count}
        aria-label={`خفض ${label}`}
        onClick={() => onMove(1)}
      >
        <ArrowDownIcon data-icon="inline-start" />
      </Button>
    </div>
  );
}
