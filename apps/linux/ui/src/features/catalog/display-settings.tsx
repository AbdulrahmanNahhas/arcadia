import {
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  List,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Settings2,
  Type,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../components/ui/popover";
import { Separator } from "../../components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";

export type DisplayPreferences = {
  layout: "poster" | "banner" | "logo" | "table";
  size: "compact" | "normal" | "comfortable";
  minimal: boolean;
  borderless: boolean;
  showScore: boolean;
  showStatus: boolean;
};
export const displayDefaults: DisplayPreferences = {
  layout: "poster",
  size: "normal",
  minimal: false,
  borderless: false,
  showScore: true,
  showStatus: true,
};

const layouts = [
  { value: "poster", label: "ملصقات", icon: RectangleVertical },
  { value: "banner", label: "لافتات", icon: RectangleHorizontal },
  { value: "logo", label: "شعارات", icon: Type },
  { value: "table", label: "جدول", icon: List },
] as const;
const sizes = [
  { value: "compact", label: "بطاقات صغيرة", icon: Grid3X3 },
  { value: "normal", label: "بطاقات متوسطة", icon: LayoutGrid },
  { value: "comfortable", label: "بطاقات كبيرة", icon: Grid2X2 },
] as const;

export function DisplaySettings({
  value,
  onChange,
}: {
  value: DisplayPreferences;
  onChange: (value: DisplayPreferences) => void;
}) {
  const table = value.layout === "table";
  return (
    <TooltipProvider delay={350}>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          spacing={1}
          value={[value.layout]}
          aria-label="طريقة العرض"
          onValueChange={(values) => {
            const next = layouts.find((item) => item.value === values[0]);
            if (next) onChange({ ...value, layout: next.value });
          }}
        >
          {layouts.map((item) => (
            <Tooltip key={item.value}>
              <TooltipTrigger
                render={<ToggleGroupItem value={item.value} aria-label={item.label} />}
              >
                <item.icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <Separator orientation="vertical" className="h-6 max-[520px]:hidden" />
        <ToggleGroup
          variant="outline"
          spacing={1}
          value={[value.size]}
          disabled={table}
          aria-label="حجم البطاقات"
          onValueChange={(values) => {
            const next = sizes.find((item) => item.value === values[0]);
            if (next) onChange({ ...value, size: next.value });
          }}
        >
          {sizes.map((item) => (
            <Tooltip key={item.value}>
              <TooltipTrigger
                render={<ToggleGroupItem value={item.value} aria-label={item.label} />}
              >
                <item.icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="إعدادات العرض"
                title="إعدادات العرض"
              />
            }
          >
            <Settings2 aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 max-w-full">
            <PopoverHeader>
              <PopoverTitle>إعدادات العرض</PopoverTitle>
              <PopoverDescription>خصص البطاقات في هذه الصفحة.</PopoverDescription>
            </PopoverHeader>
            <FieldGroup>
              {(
                [
                  { key: "minimal", label: "الصور فقط، بلا تفاصيل", disabled: table },
                  { key: "showScore", label: "إظهار التقييم", disabled: table || value.minimal },
                  {
                    key: "showStatus",
                    label: "إظهار حالة الإصدار",
                    disabled: table || value.minimal,
                  },
                  {
                    key: "borderless",
                    label: "شعارات بلا إطار أو خلفية",
                    disabled: value.layout !== "logo",
                  },
                ] as const
              ).map((item) => (
                <Field key={item.key} orientation="horizontal" data-disabled={item.disabled}>
                  <Checkbox
                    id={`display-${item.key}`}
                    checked={value[item.key]}
                    disabled={item.disabled}
                    onCheckedChange={(checked) =>
                      onChange({ ...value, [item.key]: checked === true })
                    }
                  />
                  <FieldLabel htmlFor={`display-${item.key}`}>{item.label}</FieldLabel>
                </Field>
              ))}
            </FieldGroup>
            <Separator />
            <Button variant="ghost" onClick={() => onChange(displayDefaults)}>
              <RotateCcw data-icon="inline-start" /> استعادة العرض الافتراضي
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
