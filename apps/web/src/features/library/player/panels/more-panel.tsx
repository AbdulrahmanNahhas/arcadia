import {
  ClockCounterClockwiseIcon,
  CornersInIcon,
  CornersOutIcon,
  DotsThreeIcon,
  GaugeIcon,
  StackIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { PlayerActions } from "../hooks/use-player-actions";
import type { PanelKind } from "../types";
import { PanelItem, PanelSection, PanelShell } from "./panel-shell";

/** The phone layout's overflow: everything the narrow bar had no room for. */
export function MorePanel({
  actions,
  sourceCount,
  onOpenPanel,
  onClose,
}: {
  actions: PlayerActions;
  sourceCount: number;
  onOpenPanel: (panel: PanelKind) => void;
  onClose: () => void;
}) {
  return (
    <PanelShell title="المزيد" icon={<DotsThreeIcon weight="bold" size={20} />} onClose={onClose}>
      <PanelSection>
        <PanelItem
          leading={
            <Glyph>{actions.speed === 1 ? <GaugeIcon size={20} /> : `${actions.speed}×`}</Glyph>
          }
          label="سرعة التشغيل"
          description={actions.speed === 1 ? "عادية" : `${actions.speed}×`}
          onClick={() => onOpenPanel("speed")}
          trailing={<span />}
        />
        <PanelItem
          leading={
            <Glyph>
              <StackIcon size={20} />
            </Glyph>
          }
          label="مصدر التشغيل"
          description={`${sourceCount} مصدر`}
          onClick={() => onOpenPanel("source")}
          trailing={<span />}
        />
        <PanelItem
          leading={
            <Glyph>
              <ClockCounterClockwiseIcon size={20} />
            </Glyph>
          }
          label="ابدأ من البداية"
          onClick={() => {
            void actions.restart();
            onClose();
          }}
          trailing={<span />}
        />
        <PanelItem
          leading={
            <Glyph>
              {actions.fullscreen ? <CornersInIcon size={20} /> : <CornersOutIcon size={20} />}
            </Glyph>
          }
          label={actions.fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          onClick={() => {
            void actions.toggleFullscreen();
            onClose();
          }}
          trailing={<span />}
        />
      </PanelSection>
    </PanelShell>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/8 font-mono text-xs text-white/85">
      {children}
    </span>
  );
}
