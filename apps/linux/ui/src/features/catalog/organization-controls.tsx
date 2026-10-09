import { ArrowDownUp, Layers } from "lucide-react";

import { Button } from "../../components/ui/button";
import { FieldDescription, FieldLegend, FieldSet } from "../../components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { groupChoices, parseGroup, parseSort, sortChoices } from "./browse-refinements";
import type { BrowseGroup, SortOrder } from "./browse-refinements";

export function OrganizationFields({
  sort,
  group,
  onSort,
  onGroup,
}: {
  sort: SortOrder;
  group: BrowseGroup;
  onSort: (value: SortOrder) => void;
  onGroup: (value: BrowseGroup) => void;
}) {
  return (
    <>
      <FieldSet>
        <FieldLegend>ترتيب النتائج</FieldLegend>
        <ToggleGroup
          orientation="vertical"
          variant="outline"
          spacing={2}
          value={[sort]}
          aria-label="ترتيب النتائج"
          onValueChange={(values) => {
            if (values[0]) onSort(parseSort(values[0]));
          }}
          className="w-full items-stretch"
        >
          {sortChoices.map((choice) => (
            <ToggleGroupItem
              key={choice.value}
              value={choice.value}
              className="h-auto justify-start py-3"
            >
              <span className="flex flex-col items-start gap-1 text-start">
                <span>{choice.label}</span>
                <span className="text-xs text-muted-foreground">{choice.description}</span>
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>تجميع النتائج</FieldLegend>
        <ToggleGroup
          variant="outline"
          spacing={2}
          value={[group]}
          aria-label="تجميع النتائج"
          onValueChange={(values) => {
            if (values[0]) onGroup(parseGroup(values[0]));
          }}
          className="flex-wrap"
        >
          {groupChoices.map((choice) => (
            <ToggleGroupItem key={choice.value} value={choice.value}>
              {choice.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldDescription>
          التجميع ينظّم النتائج المحمّلة فقط. تحميل المزيد يضيف العناصر إلى مجموعاتها؛ لا يغيّر ترتيب
          المكتبة.
        </FieldDescription>
      </FieldSet>
    </>
  );
}

export function OrganizationControls(props: Parameters<typeof OrganizationFields>[0]) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        <ArrowDownUp data-icon="inline-start" />
        {sortChoices.find((choice) => choice.value === props.sort)?.label}
        {props.group !== "none" && (
          <>
            <Layers data-icon="inline-end" />
            {groupChoices.find((choice) => choice.value === props.group)?.label}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-full gap-6 p-5">
        <PopoverHeader>
          <PopoverTitle>الترتيب والتجميع</PopoverTitle>
          <PopoverDescription>اختر تسلسل النتائج وطريقة تنظيمها.</PopoverDescription>
        </PopoverHeader>
        <OrganizationFields {...props} />
      </PopoverContent>
    </Popover>
  );
}
