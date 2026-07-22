import { Badge } from "@/components/ui/badge"
import { Field } from "./field"
import { XIcon } from "@phosphor-icons/react"
import { useState, type KeyboardEvent } from "react"

export function ArrayField({
  label,
  value = [],
  onChange,
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [inputValue, setInputValue] = useState("")

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue("")
  }

  const removeTag = (indexToRemove: number) => {
    onChange(value.filter((_, index) => index !== indexToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1)
    }
  }

  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 min-h-[40px] items-center">
        {value.map((tag, index) => (
          <Badge
            key={`${tag}-${index}`}
            variant="secondary"
            className="text-xs py-0.5 pl-2 pr-1 gap-1 flex items-center font-normal"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors cursor-pointer"
            >
              <XIcon className="size-3 text-muted-foreground hover:text-foreground" />
              <span className="sr-only">Remove {tag}</span>
            </button>
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue && addTag(inputValue)}
          placeholder={value.length === 0 ? "Type and press Enter..." : ""}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground min-w-[120px]"
        />
      </div>
    </Field>
  )
}
