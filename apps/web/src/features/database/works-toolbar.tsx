import { SearchIcon, XIcon, ChevronDownIcon } from "lucide-react";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { CatalogSearch } from "./works-model";

interface Choice<T extends string> {
  value: T;
  label: string;
}
export function CatalogSelect<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T | undefined;
  choices: readonly Choice<T>[];
  onChange: (value: T | undefined) => void;
}) {
  const items = [{ value: "all", label }, ...choices];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" aria-label={label} />}>
        {items.find((item) => item.value === (value ?? "all"))?.label}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={value ?? "all"}
            onValueChange={(next) =>
              onChange(choices.find((choice) => choice.value === next)?.value)
            }
          >
            {items.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function WorksToolbar({
  state,
  searchRef,
  onChange,
}: {
  state: CatalogSearch & { q?: string };
  searchRef: Ref<HTMLInputElement>;
  onChange: (patch: CatalogSearch & { q?: string }) => void;
}) {
  return (
    <FieldGroup className="flex flex-row flex-wrap items-center">
      <Field className="min-w-48 flex-1 basis-64">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            id="works-search"
            value={state.q ?? ""}
            onChange={(event) => onChange({ q: event.target.value || undefined })}
            placeholder="الاسم العربي، الأصلي أو البديل…"
            maxLength={300}
            aria-label="بحث الأعمال"
          />
          <InputGroupAddon align="inline-end">
            {state.q ? (
              <InputGroupButton
                size="icon-xs"
                aria-label="مسح البحث"
                onClick={() => onChange({ q: undefined })}
              >
                <XIcon />
              </InputGroupButton>
            ) : (
              <span aria-hidden="true" className="font-utility text-xs">
                /
              </span>
            )}
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <CatalogChips
        label="البنية"
        value={state.structure}
        onChange={(structure) => onChange({ structure })}
        choices={[
          { value: "movie", label: "أفلام" },
          { value: "series", label: "مسلسلات" },
        ]}
      />
      <CatalogChips
        label="الصيغة"
        value={state.format}
        onChange={(format) => onChange({ format })}
        choices={[
          { value: "animated", label: "رسوم" },
          { value: "live-action", label: "حيّ" },
        ]}
      />
      <CatalogChips
        label="الظهور"
        value={state.visibility}
        onChange={(visibility) => onChange({ visibility })}
        choices={[
          { value: "public", label: "عام" },
          { value: "private", label: "خاص" },
        ]}
      />
    </FieldGroup>
  );
}
export function WorksFilters({
  state,
  onChange,
}: {
  state: CatalogSearch;
  onChange: (patch: CatalogSearch) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <CatalogSelect
        label="حالة النشر"
        value={state.workflow}
        onChange={(workflow) => onChange({ workflow })}
        choices={[
          { value: "draft", label: "مسودة" },
          { value: "in_review", label: "قيد المراجعة" },
          { value: "approved", label: "معتمد" },
          { value: "published", label: "منشور" },
          { value: "archived", label: "مؤرشف" },
        ]}
      />
      <CatalogSelect
        label="النواقص"
        value={state.gap}
        onChange={(gap) => onChange({ gap })}
        choices={[
          { value: "poster", label: "بلا ملصق" },
          { value: "summary", label: "بلا ملخص" },
          { value: "arabic-name", label: "بلا اسم عربي" },
          { value: "structure", label: "بلا أجزاء" },
        ]}
      />
    </div>
  );
}

function CatalogChips<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T | undefined;
  choices: readonly Choice<T>[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      aria-label={label}
      value={value ? [value] : []}
      onValueChange={(values) =>
        onChange(choices.find((choice) => choice.value === values[0])?.value)
      }
    >
      {choices.map((choice) => (
        <ToggleGroupItem key={choice.value} value={choice.value}>
          {choice.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
