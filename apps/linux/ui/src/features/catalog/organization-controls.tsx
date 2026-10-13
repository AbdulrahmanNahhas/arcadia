import { Choice } from "../../components/choice";
import { groupChoices, parseGroup, parseSort, sortChoices } from "./browse-refinements";
import type { BrowseGroup, SortOrder } from "./browse-refinements";

export function OrganizationControls({
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
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Choice
        label="ترتيب النتائج"
        value={sort}
        options={sortChoices.map((item) => ({ value: item.value, label: item.label }))}
        onChange={(next) => onSort(parseSort(next))}
      />
      <Choice
        label="تجميع النتائج"
        value={group}
        options={groupChoices.map((item) => ({
          value: item.value,
          label: item.value === "none" ? item.label : `حسب ${item.label}`,
        }))}
        onChange={(next) => onGroup(parseGroup(next))}
      />
    </div>
  );
}
