import { CaretDownIcon, CaretUpIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";

/**
 * Ordered list editor for a title's trivia facts ("الأصل والقصة", "المكان", "حقائق بارزة" —
 * see the arcadia-cataloging skill). Unlike `ArrayField` (single-line chips, for short tags like
 * aliases), each entry here is a full Arabic sentence, so it gets its own `Textarea` row — and
 * unlike `ContributionField`, order is directly visible on the title page, so rows carry
 * move-up/move-down controls rather than only add/remove.
 */
const EMPTY_TRIVIA: string[] = [];

export function TriviaField({
  value = EMPTY_TRIVIA,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  // Entries are free text with no domain id of their own (unlike aliases/credits, plain strings
  // can repeat), so React keys are tracked here, alongside `value`, purely for stable identity.
  const [rowIds, setRowIds] = useState<string[]>(() => value.map(() => crypto.randomUUID()));
  // Adjust the id list while rendering (React's supported pattern for deriving state from a
  // changed prop) rather than in an effect, so a length mismatch never renders with stale keys.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (rowIds.length !== value.length) {
      const next = rowIds.slice(0, value.length);
      while (next.length < value.length) next.push(crypto.randomUUID());
      setRowIds(next);
    }
  }

  const update = (index: number, text: string) => {
    onChange(value.map((fact, current) => (current === index ? text : fact)));
  };
  const remove = (index: number) => {
    setRowIds((ids) => ids.filter((_, current) => current !== index));
    onChange(value.filter((_, current) => current !== index));
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    setRowIds((ids) => {
      const nextIds = [...ids];
      const [movedId] = nextIds.splice(index, 1);
      if (movedId !== undefined) nextIds.splice(target, 0, movedId);
      return nextIds;
    });
    onChange(next);
  };

  return (
    <Field label="حقائق ومعلومات" wide>
      <div className="flex flex-col gap-2">
        {value.map((fact, index) => (
          <div
            key={rowIds[index]}
            className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 p-2"
          >
            <div className="flex flex-col gap-0.5 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="نقل للأعلى"
              >
                <CaretUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
                aria-label="نقل للأسفل"
              >
                <CaretDownIcon />
              </Button>
            </div>
            <Textarea
              dir="rtl"
              lang="ar"
              rows={2}
              value={fact}
              onChange={(event) => update(index, event.target.value)}
              placeholder="مثال: الأصل والقصة: قصة أصلية كتبها هاياو ميازاكي…"
              className="min-w-0 flex-1 resize-y bg-background text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(index)}
              aria-label="حذف الحقيقة"
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
          إضافة حقيقة
        </Button>
      </div>
    </Field>
  );
}
