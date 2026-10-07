import { BackspaceIcon, TranslateIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
  FocusContext,
  revealSpatialTarget,
  useSpatialFocusable,
} from "@/features/platform/spatial-navigation";
import { cn } from "@/lib/utils";

const layouts = {
  ar: ["ضصثقفغعهخحج", "شسيبلاتنمكط", "ئءؤرلاىةوزظ", "دذأإآ"],
  en: ["abcdefghij", "klmnopqrst", "uvwxyz", "0123456789"],
} as const;
type Layout = keyof typeof layouts;

/**
 * A D-pad keyboard for Search in Display Mode. Every key is a spatial target; the ordinary
 * hardware keyboard still works when one is plugged in — this only exists for the remote.
 * Layout swaps Arabic ↔ Latin; digits sit under Latin, a space and backspace on the last row.
 */
export function OnScreenKeyboard({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [layout, setLayout] = useState<Layout>("ar");
  const rows = layouts[layout];
  return (
    <FocusContext.Provider value="osk">
      <div className="flex flex-col gap-2" dir={layout === "ar" ? "rtl" : "ltr"}>
        {rows.map((row) => (
          <div key={row} className="flex flex-wrap justify-center gap-2">
            {[...row].map((key) => (
              <Key key={key} label={key} onPress={() => onChange(value + key)} />
            ))}
          </div>
        ))}
        <div className="flex justify-center gap-2" dir="rtl">
          <Key
            label={layout === "ar" ? "ABC" : "أبج"}
            icon={<TranslateIcon size={22} />}
            wide
            onPress={() => setLayout(layout === "ar" ? "en" : "ar")}
          />
          <Key label="مسافة" wide onPress={() => onChange(`${value} `)} />
          <Key
            label="حذف"
            icon={<BackspaceIcon size={22} />}
            wide
            onPress={() => onChange(value.slice(0, -1))}
          />
          <Key label="مسح الكل" wide onPress={() => onChange("")} />
        </div>
      </div>
    </FocusContext.Provider>
  );
}

function Key({
  label,
  icon,
  wide,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  wide?: boolean;
  onPress: () => void;
}) {
  const { ref, focused } = useSpatialFocusable<object, HTMLButtonElement>({
    onEnterPress: onPress,
    onFocus: ({ node }) => revealSpatialTarget(node),
  });
  return (
    <button
      ref={ref}
      type="button"
      data-display-chrome
      data-focused={focused || undefined}
      onClick={onPress}
      aria-label={label}
      className={cn(
        "flex h-14 items-center justify-center gap-2 rounded-xl bg-white/10 text-2xl font-medium outline-none",
        wide ? "min-w-32 px-5 text-lg" : "w-14",
      )}
    >
      {icon}
      {icon ? <span className="text-base">{label}</span> : label}
    </button>
  );
}
