import { SpeakerHighIcon, SpeakerLowIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import { Slider } from "@/components/ui/slider";
import { ControlButton } from "./control-button";

/** Mute toggle with a slider that unfolds on hover or keyboard focus. */
export function VolumeControl({
  muted,
  volume,
  onToggleMute,
  onSetVolume,
}: {
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
}) {
  const Icon =
    muted || volume === 0 ? SpeakerSlashIcon : volume < 50 ? SpeakerLowIcon : SpeakerHighIcon;
  return (
    <div dir="ltr" className="group/volume flex items-center">
      <ControlButton
        label={muted ? "إلغاء الكتم" : "كتم الصوت"}
        hint="M"
        name="mute"
        onClick={onToggleMute}
      >
        <Icon size={22} />
      </ControlButton>
      <div className="flex w-0 items-center overflow-hidden opacity-0 transition-[width,opacity,margin] duration-200 ease-out group-focus-within/volume:ms-1 group-focus-within/volume:w-24 group-focus-within/volume:opacity-100 group-hover/volume:ms-1 group-hover/volume:w-24 group-hover/volume:opacity-100">
        <Slider
          value={[muted ? 0 : volume]}
          min={0}
          max={100}
          step={1}
          // Base UI hands back an array for a multi-thumb slider and a number for a single one.
          onValueChange={(value) => onSetVolume(Array.isArray(value) ? (value[0] ?? 0) : value)}
          aria-label="مستوى الصوت"
          // Not a `data-player-control`: arrows on the slider are Base UI's own (5-step) — the
          // D-pad model reaches volume through Up/Down in video mode instead.
          className="w-full **:data-[slot=slider-range]:bg-white **:data-[slot=slider-thumb]:border-white **:data-[slot=slider-thumb]:bg-white **:data-[slot=slider-track]:bg-white/20 **:data-[slot=slider-track]:data-horizontal:h-1.5"
        />
      </div>
    </div>
  );
}
