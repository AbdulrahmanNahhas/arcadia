import { GaugeIcon } from "@phosphor-icons/react";
import { PLAYBACK_SPEEDS } from "../constants";
import { PanelItem, PanelSection, PanelShell } from "./panel-shell";

export function SpeedPanel({
  speed,
  onSetSpeed,
  onClose,
}: {
  speed: number;
  onSetSpeed: (speed: number) => void;
  onClose: () => void;
}) {
  return (
    <PanelShell title="سرعة التشغيل" icon={<GaugeIcon size={20} />} onClose={onClose}>
      <PanelSection>
        {PLAYBACK_SPEEDS.map((option) => (
          <PanelItem
            key={option}
            leading={
              <span className="w-12 shrink-0 text-center font-mono text-sm tabular-nums text-white/80">
                {option}×
              </span>
            }
            label={speedLabel(option)}
            selected={speed === option}
            onClick={() => {
              onSetSpeed(option);
              onClose();
            }}
          />
        ))}
      </PanelSection>
    </PanelShell>
  );
}

function speedLabel(speed: number) {
  if (speed === 1) return "عادية";
  return speed < 1 ? "أبطأ" : "أسرع";
}
