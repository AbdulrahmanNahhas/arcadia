import { PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field } from "./field"

const contentTypes = [
  "Chapters",
  "Volumes",
  "Parts",
  "Books",
  "Stories",
  "Essays",
  "Poems",
  "Routes",
  "Acts",
  "Episodes",
  "Extras",
] as const

export function ContentField({
  value = [],
  onChange,
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const update = (index: number, next: string) => {
    onChange(
      value.map((item, itemIndex) => (itemIndex === index ? next : item))
    )
  }

  return (
    <Field label="Contents" wide>
      <div className="flex flex-col gap-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-md border bg-muted/30 p-2"
          >
            <Input
              value={item}
              onChange={(event) => update(index, event.target.value)}
              placeholder="e.g. 41 chapters or Part One"
              className="h-8 flex-1 bg-background text-xs"
            />
            <Select
              onValueChange={(contentType) =>
                typeof contentType === "string" && update(index, contentType)
              }
            >
              <SelectTrigger className="h-8 w-32 bg-background text-xs">
                <SelectValue placeholder="Quick type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {contentTypes.map((contentType) => (
                    <SelectItem key={contentType} value={contentType}>
                      {contentType}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                onChange(value.filter((_, itemIndex) => itemIndex !== index))
              }
              aria-label={`Remove content ${index + 1}`}
            >
              <TrashIcon data-icon="inline-start" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, ""])}
          className="w-full border-dashed"
        >
          <PlusIcon data-icon="inline-start" />
          Add content item
        </Button>
      </div>
    </Field>
  )
}
