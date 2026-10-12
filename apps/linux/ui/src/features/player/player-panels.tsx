import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "cn";
import { X } from "lucide-react";
import { useId, type ComponentProps, type ReactNode, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverTitle } from "@/components/ui/popover";

/** Larger transport targets belong to the viewing client, not dashboard button variants. */
export function PlayerControl({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className={cn(
        "player-control size-11 max-[480px]:size-10 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

/** The episode shelf anchors to the entire footer; other panels anchor to their own trigger. */
export function PlayerPopover({
  title,
  icon,
  open,
  onOpenChange,
  children,
  anchor,
  wide = false,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  anchor?: RefObject<HTMLElement | null>;
  wide?: boolean;
}) {
  const triggerId = useId();
  return (
    <Popover open={open} onOpenChange={onOpenChange} triggerId={triggerId}>
      <PopoverTrigger id={triggerId} render={<PlayerControl aria-label={title} title={title} />}>
        {icon}
      </PopoverTrigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="top"
          align={wide ? "center" : "end"}
          sideOffset={12}
          collisionPadding={16}
          collisionAvoidance={{ side: "shift", align: "shift" }}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            className={cn(
              "player-panel flex flex-col w-96 max-w-[calc(100vw_-_2rem)] max-h-[min(38rem,var(--available-height))] overflow-hidden border border-border rounded-[calc(var(--radius)_*_1.5)] bg-card text-foreground [box-shadow:0_1rem_3rem_color-mix(in_srgb,_var(--rail),_transparent_35%)] outline-none font-sans transition-opacity duration-120 [&[data-starting-style]]:opacity-0 [&[data-ending-style]]:opacity-0 motion-reduce:animate-none motion-reduce:transition-none",
              wide &&
                "player-panel-wide w-[calc(100vw_-_3.5rem)] max-w-[calc(100vw_-_2rem)] max-h-[min(32rem,var(--available-height))] [&_.player-panel-body]:py-4 [&_.player-panel-body]:px-6 max-[800px]:w-[calc(100vw_-_2rem)] max-[800px]:[&_.player-panel-body]:p-4",
            )}
            dir="rtl"
          >
            <div className="player-panel-heading flex shrink-0 items-center justify-between gap-4 py-[0.65rem] px-[1.1rem] border-b border-border">
              <PopoverTitle className="player-panel-title m-0 text-base font-semibold">
                {title}
              </PopoverTitle>
              <PopoverPrimitive.Close
                render={<PlayerControl aria-label={`إغلاق ${title}`} title={`إغلاق ${title}`} />}
              >
                <X data-icon="inline-start" />
              </PopoverPrimitive.Close>
            </div>
            <div className="player-panel-body min-h-0 overflow-y-auto overscroll-contain p-[1.1rem]">
              {children}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
