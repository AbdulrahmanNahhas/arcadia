import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Slider } from "@base-ui/react/slider";
import { useRef, useState } from "react";
import { z } from "zod";

type PlayerSliderProps = {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  disabled?: boolean;
  format?: (value: number) => string;
  commit: (value: number) => void;
};

/** What Base UI emits: a number, or an array with one entry per thumb. */
type SliderPayload = number | readonly number[];

const SliderPayloadSchema = z.union([
  z.number().finite(),
  z.tuple([z.number().finite()]).transform(([n]) => n),
]);

/** Domain type: a parsed, in-range slider position. Only `parseSliderValue` can make one. */
const SliderValueSchema = z.number().finite().brand<"SliderValue">();
type SliderValue = z.infer<typeof SliderValueSchema>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function parseSliderValue(payload: SliderPayload, min: number, max: number): SliderValue | null {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null;
  const parsed = SliderPayloadSchema.safeParse(payload);
  return parsed.success ? SliderValueSchema.parse(clamp(parsed.data, min, max)) : null;
}

/** Remote updates never overwrite an unfinished drag. */
export function PlayerSlider({
  label,
  value,
  min = 0,
  max,
  step = 1,
  disabled = false,
  format,
  commit,
}: PlayerSliderProps) {
  const [draft, setDraft] = useState<SliderValue | null>(null);
  const canceled = useRef(false);
  const validRange = Number.isFinite(min) && Number.isFinite(max) && min < max;
  const validStep = Number.isFinite(step) && step > 0;
  const isDisabled = disabled || !validRange || !validStep;
  // Invalid constraints render an inert, finite range; no invented value is committed.
  const lower = validRange ? min : 0;
  const upper = validRange ? max : 1;
  const remote = Number.isFinite(value) ? clamp(value, lower, upper) : lower;
  const shown = clamp(isDisabled ? remote : (draft ?? remote), lower, upper);

  function cancelDraft() {
    canceled.current = true;
    setDraft(null);
  }

  return (
    <DirectionProvider direction="ltr">
      <Slider.Root
        data-slot="slider"
        data-drafting={draft !== null || undefined}
        value={[shown]}
        min={lower}
        max={upper}
        step={validStep ? step : 1}
        disabled={isDisabled}
        thumbAlignment="edge"
        className="player-slider w-full"
        onPointerDownCapture={(event) => {
          if (isDisabled || event.button !== 0) return;
          canceled.current = false;
          // Freeze even a press that has not moved yet, before the next remote poll.
          setDraft(parseSliderValue(shown, lower, upper));
        }}
        onPointerUpCapture={() => setDraft(null)}
        onPointerCancelCapture={cancelDraft}
        onTouchEndCapture={() => setDraft(null)}
        onTouchCancelCapture={cancelDraft}
        onKeyDownCapture={(event) => {
          if (event.key === "Escape" && draft !== null) {
            event.preventDefault();
            event.stopPropagation();
            cancelDraft();
          } else if (
            !isDisabled &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(event.key)
          ) {
            canceled.current = false;
          }
        }}
        onValueChange={(payload, details) => {
          const next = parseSliderValue(payload, lower, upper);
          if (
            isDisabled ||
            next === null ||
            (canceled.current && (details.reason === "drag" || details.reason === "track-press"))
          ) {
            details.cancel();
            return;
          }
          canceled.current = false;
          setDraft(next);
        }}
        onValueCommitted={(payload) => {
          setDraft(null);
          if (isDisabled || canceled.current) return;
          const next = parseSliderValue(payload, lower, upper);
          if (next !== null) commit(next);
        }}
      >
        <Slider.Control
          data-slot="slider-control"
          className="player-slider-control relative flex h-5 w-full touch-none items-center select-none data-disabled:opacity-50"
        >
          <Slider.Track
            data-slot="slider-track"
            className="player-slider-track relative h-1 w-full grow overflow-hidden rounded-full bg-muted select-none"
          >
            <Slider.Indicator
              data-slot="slider-range"
              className="player-slider-range h-full bg-primary select-none"
            />
          </Slider.Track>
          <Slider.Thumb
            index={0}
            data-slot="slider-thumb"
            aria-label={label}
            aria-valuetext={format ? format(shown) : String(shown)}
            disabled={isDisabled}
            onBlur={cancelDraft}
            className="player-slider-thumb relative block size-3 shrink-0 rounded-full border border-ring bg-foreground ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 has-focus-visible:ring-3 has-focus-visible:outline-hidden data-dragging:ring-3 data-disabled:pointer-events-none data-disabled:opacity-50 motion-reduce:transition-none"
          />
        </Slider.Control>
      </Slider.Root>
    </DirectionProvider>
  );
}
