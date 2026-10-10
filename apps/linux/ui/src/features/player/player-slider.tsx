import { Slider } from "@base-ui/react/slider";
import { useState } from "react";

/** Only the unfinished gesture is local; remote ticks never overwrite a drag. */
export function PlayerSlider({
  label,
  value,
  min = 0,
  max,
  step = 1,
  disabled = false,
  format,
  commit,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  disabled?: boolean;
  format?: (value: number) => string;
  commit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  return (
    <Slider.Root
      className="player-slider"
      value={draft ?? Math.max(min, Math.min(max, value))}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      thumbAlignment="edge"
      onValueChange={(next) => setDraft(Array.isArray(next) ? (next[0] ?? min) : next)}
      onValueCommitted={(next) => {
        commit(Array.isArray(next) ? (next[0] ?? min) : next);
        setDraft(null);
      }}
      onPointerCancel={() => setDraft(null)}
      onLostPointerCapture={() => setDraft(null)}
    >
      <Slider.Control className="player-slider-control">
        <Slider.Track className="player-slider-track">
          <Slider.Indicator className="player-slider-indicator" />
          <Slider.Thumb
            className="player-slider-thumb"
            aria-label={label}
            getAriaValueText={format ? (next) => format(Number(next)) : undefined}
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
