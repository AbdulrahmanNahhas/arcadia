import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The one look every control in the chrome shares. `data-player-control` is what the D-pad model
 * in `use-player-shortcuts.ts` walks, so a control without it is unreachable from a remote.
 */
export const controlClass = cn(
  "grid size-10 shrink-0 place-items-center rounded-full text-white/85 outline-none",
  "transition-[background-color,color,transform] duration-150",
  "hover:bg-white/12 hover:text-white active:scale-95",
  "focus-visible:bg-white/15 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white",
  "disabled:pointer-events-none disabled:opacity-30",
);

export function ControlButton({
  label,
  hint,
  name,
  onClick,
  disabled,
  active,
  className,
  children,
}: {
  label: string;
  /** Keyboard hint shown after the label in the tooltip. */
  hint?: string;
  /** `data-player-control` value; `"play"` is where Enter lands from video mode. */
  name?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Highlights a control whose setting is away from its default (1.25× speed, say). */
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            data-player-control={name ?? label}
            className={cn(controlClass, active && "text-white", className)}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {hint && <span className="ms-2 text-muted-foreground">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
