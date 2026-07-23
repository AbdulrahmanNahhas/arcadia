import { Input } from "@/components/ui/input"
import { Field } from "./field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { creatorRoles } from "@/features/library/model"
import type { WorkCredit } from "@/features/library/model"

export function CreditField({
  value = [],
  onChange,
}: {
  value: WorkCredit[]
  onChange: (value: WorkCredit[]) => void
}) {
  const handleUpdate = (
    index: number,
    field: keyof WorkCredit,
    fieldValue: string
  ) => {
    const updated = value.map((credit, i) => {
      if (i !== index) return credit
      const newCredit = { ...credit, [field]: fieldValue }
      // Keep entityId sync'd
      newCredit.entityId = `${newCredit.entityType}:${newCredit.name.trim() ? newCredit.name : "unnamed"}`
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
        role: "creator",
      },
    ])
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <Field label="Primary creators & credits" wide>
      <div className="space-y-2">
        {value.map((credit, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 p-2"
          >
            {/* Contributor Name */}
            <Input
              placeholder="Name (e.g. Naoki Urasawa)"
              value={credit.name}
              onChange={(e) => handleUpdate(index, "name", e.target.value)}
              className="h-8 flex-[2] bg-background text-xs"
            />

            {/* Entity Type Selector */}
            <Select
              value={credit.entityType}
              onValueChange={(val) =>
                handleUpdate(index, "entityType", val ?? "person")
              }
            >
              <SelectTrigger className="h-8 w-28 bg-background text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">Person</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="publisher">Publisher</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
              </SelectContent>
            </Select>

            {/* Role */}
            <Select
              value={credit.role}
              onValueChange={(role) =>
                handleUpdate(index, "role", role ?? "creator")
              }
            >
              <SelectTrigger className="h-8 flex-[1.5] bg-background text-xs">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {creatorRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Remove Action */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
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
          className="flex h-8 w-full items-center justify-center gap-1.5 border-dashed text-xs"
        >
          <PlusIcon className="size-3.5" />
          Add Contributor
        </Button>
      </div>
    </Field>
  )
}
