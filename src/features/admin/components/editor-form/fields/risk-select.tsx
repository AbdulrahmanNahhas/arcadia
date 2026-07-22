import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type RiskLevel = "none" | "low" | "medium" | "high" | "unknown"

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; dotColor: string; textColor: string }
> = {
  none: { label: "None", dotColor: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
  low: { label: "Low", dotColor: "bg-sky-500", textColor: "text-sky-600 dark:text-sky-400" },
  medium: { label: "Medium", dotColor: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
  high: { label: "High", dotColor: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400" },
  unknown: { label: "Unknown", dotColor: "bg-slate-400", textColor: "text-muted-foreground" },
}

export function RiskSelect({
  value = "unknown",
  onChange,
}: {
  value: RiskLevel
  onChange: (value: RiskLevel) => void
}) {
  const currentRisk = RISK_CONFIG[value] ?? RISK_CONFIG.unknown

  return (
    <Select value={value} onValueChange={(val) => onChange(val as RiskLevel)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select risk level">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", currentRisk.dotColor)} />
            <span className={cn("text-xs font-medium capitalize", currentRisk.textColor)}>
              {currentRisk.label}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(RISK_CONFIG) as RiskLevel[]).map((riskKey) => {
          const config = RISK_CONFIG[riskKey]
          return (
            <SelectItem key={riskKey} value={riskKey}>
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", config.dotColor)} />
                <span className="capitalize">{config.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  )
}
