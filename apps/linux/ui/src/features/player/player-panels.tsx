import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "cn";
import { X } from "lucide-react";
import { useId, type ComponentProps, type ReactNode, type RefObject } from "react";

/** Larger transport targets belong to the viewing client, not dashboard button variants. */
export function PlayerControl({ className, ...props }: ComponentProps<typeof ButtonPrimitive>) {
  return <ButtonPrimitive className={cn("player-control", className)} {...props} />;
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
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} triggerId={triggerId}>
      <PopoverPrimitive.Trigger
        id={triggerId}
        render={<PlayerControl aria-label={title} title={title} />}
      >
        {icon}
      </PopoverPrimitive.Trigger>
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
            className={cn("player-panel", wide && "player-panel-wide")}
            dir="rtl"
          >
            <div className="player-panel-heading">
              <PopoverPrimitive.Title className="player-panel-title">
                {title}
              </PopoverPrimitive.Title>
              <PopoverPrimitive.Close
                render={<PlayerControl aria-label={`إغلاق ${title}`} title={`إغلاق ${title}`} />}
              >
                <X data-icon="inline-start" />
              </PopoverPrimitive.Close>
            </div>
            <div className="player-panel-body">{children}</div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
