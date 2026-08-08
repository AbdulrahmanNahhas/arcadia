import { XIcon } from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Field } from "./field";

export function ArrayField({
  label,
  value = [],
  onChange,
  options,
  maxItems,
  optionLabels,
  allowCustom = false,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options?: readonly string[];
  maxItems?: number;
  optionLabels?: Readonly<Record<string, string>>;
  allowCustom?: boolean;
}) {
  const listId = useId();
  const [inputValue, setInputValue] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (options && !allowCustom && !options.includes(trimmed)) return;
    if (
      trimmed &&
      !value.includes(trimmed) &&
      (maxItems === undefined || value.length < maxItems)
    ) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
  };

  const removeTag = (indexToRemove: number) => {
    onChange(value.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const suggestions = (options ?? [])
    .filter((option) => !value.includes(option))
    .filter((option) => {
      const query = inputValue.trim().toLocaleLowerCase();
      return (
        !query || `${option} ${optionLabels?.[option] ?? ""}`.toLocaleLowerCase().includes(query)
      );
    })
    .slice(0, 8);

  return (
    <Field label={label}>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {value.map((tag, index) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 py-0.5 pr-1 pl-2 text-xs font-normal"
          >
            {optionLabels?.[tag] ?? tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="cursor-pointer rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
            >
              <XIcon className="size-3 text-muted-foreground hover:text-foreground" />
              <span className="sr-only">إزالة {optionLabels?.[tag] ?? tag}</span>
            </button>
          </Badge>
        ))}
        <input
          type="text"
          list={options ? listId : undefined}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue && addTag(inputValue)}
          placeholder={value.length === 0 ? "اكتب ثم اضغط Enter…" : ""}
          disabled={maxItems !== undefined && value.length >= maxItems}
          className="min-w-30 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {options && (
          <datalist id={listId}>
            {suggestions.map((option) => (
              <option key={option} value={option}>
                {optionLabels?.[option]}
              </option>
            ))}
          </datalist>
        )}
      </div>
      {suggestions.length > 0 && inputValue && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addTag(option)}
              className="rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
            >
              {optionLabels?.[option] ?? option}
              {optionLabels?.[option] ? (
                <span className="ms-1 text-muted-foreground">{option}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      {maxItems !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          تم اختيار {value.length}/{maxItems}
        </p>
      )}
    </Field>
  );
}
