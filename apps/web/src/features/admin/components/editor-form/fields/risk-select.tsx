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

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
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
};

export function RiskSelect({
  value = "unknown",
  onChange,
}: {
  value: RiskLevel;
  onChange: (value: RiskLevel) => void;
}) {
  const currentRisk = RISK_CONFIG[value];

  return (
    <Select
      items={(Object.keys(RISK_CONFIG) as RiskLevel[]).map((risk) => ({
        value: risk,
        label: RISK_CONFIG[risk].label,
      }))}
      value={value}
      onValueChange={(val) => onChange(val as RiskLevel)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="اختر مستوى المخاطر">
          <Badge variant={currentRisk.variant}>{currentRisk.label}</Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {(Object.keys(RISK_CONFIG) as RiskLevel[]).map((riskKey) => (
            <SelectItem key={riskKey} value={riskKey}>
              {RISK_CONFIG[riskKey].label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
