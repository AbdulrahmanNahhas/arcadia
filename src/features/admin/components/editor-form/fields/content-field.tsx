import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "./field";

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
] as const;

const contentTypeLabels: Record<(typeof contentTypes)[number], string> = {
  Chapters: "فصول",
  Volumes: "مجلدات",
  Parts: "أجزاء",
  Books: "كتب",
  Stories: "قصص",
  Essays: "مقالات",
  Poems: "قصائد",
  Routes: "مسارات",
  Acts: "فصول مسرحية",
  Episodes: "حلقات",
  Extras: "إضافات",
};

export function ContentField({
  value = [],
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const update = (index: number, next: string) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? next : item)));
  };

  return (
    <Field label="المحتويات" wide>
      <div className="flex flex-col gap-2">
        {value.map((item, index) => (
          <div
            key={
              // biome-ignore lint/suspicious/noArrayIndexKey: Rows are an ordered string list with no persistent item identity.
              index
            }
            className="flex items-center gap-2 rounded-md border bg-muted/30 p-2"
          >
            <Input
              value={item}
              onChange={(event) => update(index, event.target.value)}
              placeholder="مثلاً: 41 فصلاً أو الجزء الأول"
              className="h-8 flex-1 bg-background text-xs"
            />
            <Select
              onValueChange={(contentType) =>
                typeof contentType === "string" && update(index, contentType)
              }
            >
              <SelectTrigger className="h-8 w-32 bg-background text-xs">
                <SelectValue placeholder="نوع سريع" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {contentTypes.map((contentType) => (
                    <SelectItem key={contentType} value={contentType}>
                      {contentTypeLabels[contentType]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              aria-label={`إزالة المحتوى ${index + 1}`}
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
          إضافة عنصر محتوى
        </Button>
      </div>
    </Field>
  );
}
