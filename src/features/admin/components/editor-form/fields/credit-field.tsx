import { Input } from "@/components/ui/input"
import { Field } from "./field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"
import type { WorkCredit } from "@/features/library/model"

export function CreditField({
  value = [],
  onChange,
}: {
  value: WorkCredit[]
  onChange: (value: WorkCredit[]) => void
}) {
  const handleUpdate = (index: number, field: keyof WorkCredit, fieldValue: string) => {
    const updated = value.map((credit, i) => {
      if (i !== index) return credit
      const newCredit = { ...credit, [field]: fieldValue }
      // Keep entityId sync'd
      newCredit.entityId = `${newCredit.entityType || "person"}:${newCredit.name || "unnamed"}`
      return newCredit
    })
    onChange(updated)
  }

  const handleAdd = () => {
    onChange([
      ...value,
      {
        entityId: "person:new",
        name: "",
        entityType: "person",
        role: "",
      },
    ])
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <Field label="Contributors & Credits" wide>
      <div className="space-y-2">
        {value.map((credit, index) => (
          <div
            key={index}
            className="flex items-center gap-2 bg-muted/30 p-2 rounded-md border border-border/50"
          >
            {/* Contributor Name */}
            <Input
              placeholder="Name (e.g. Naoki Urasawa)"
              value={credit.name}
              onChange={(e) => handleUpdate(index, "name", e.target.value)}
              className="flex-[2] h-8 text-xs bg-background"
            />

            {/* Entity Type Selector */}
            <Select
              value={credit.entityType || "person"}
              onValueChange={(val) => handleUpdate(index, "entityType", val)}
            >
              <SelectTrigger className="w-28 h-8 text-xs bg-background">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">Person</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
              </SelectContent>
            </Select>

            {/* Role */}
            <Input
              placeholder="Role (e.g. Author, Writer)"
              value={credit.role}
              onChange={(e) => handleUpdate(index, "role", e.target.value)}
              className="flex-[1.5] h-8 text-xs bg-background"
            />

            {/* Remove Action */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              className="size-8 text-muted-foreground hover:text-destructive shrink-0"
            >
              <TrashIcon className="size-4" />
              <span className="sr-only">Delete credit</span>
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full text-xs h-8 border-dashed flex items-center justify-center gap-1.5"
        >
          <PlusIcon className="size-3.5" />
          Add Contributor
        </Button>
      </div>
    </Field>
  )
}
