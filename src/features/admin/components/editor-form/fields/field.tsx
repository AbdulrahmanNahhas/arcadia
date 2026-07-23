import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface FieldProps {
  label: string
  wide?: boolean
  className?: string
  children: ReactNode
}

export function Field({
  label,
  wide = false,
  className,
  children,
}: FieldProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-start space-y-1.5",
        wide && "sm:col-span-2",
        className
      )}
    >
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
