import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RiskLevel = "none" | "low" | "medium" | "high" | "unknown";

const RISK_CONFIG = {
  none: {
    label: "لا يوجد",
    variant: "outline",
  },
  low: {
    label: "منخفض",
    variant: "secondary",
  },
  medium: {
    label: "متوسط",
    variant: "secondary",
  },
  high: {
    label: "مرتفع",
    variant: "destructive",
  },
  unknown: {
    label: "غير معروف",
    variant: "outline",
  },
} satisfies Record<
  RiskLevel,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
>;

export function RiskSelect({
  value = "unknown",
  onChange,
}: {
  value: RiskLevel;
  onChange: (value: RiskLevel) => void;
}) {
  const currentRisk = RISK_CONFIG[value];
  // SAFETY: RISK_CONFIG's own type is checked against `Record<RiskLevel, ...>` above
  // (`satisfies`, not a widened annotation), so its key set is exactly RiskLevel's members —
  // `Object.keys` just can't express that itself, since it always returns `string[]`.
  const riskKeys = Object.keys(RISK_CONFIG) as RiskLevel[];

  return (
    <Select
      items={riskKeys.map((risk) => ({
        value: risk,
        label: RISK_CONFIG[risk].label,
      }))}
      value={value}
      onValueChange={(val) => val && onChange(val)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="اختر مستوى المخاطر">
          <Badge variant={currentRisk.variant}>{currentRisk.label}</Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {riskKeys.map((riskKey) => (
            <SelectItem key={riskKey} value={riskKey}>
              {RISK_CONFIG[riskKey].label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
