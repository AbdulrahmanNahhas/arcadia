import { CaretDownIcon, GlobeIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LanguageFlag } from "../components/language-flag";
import type { LanguageGroup } from "../track-groups";
import { PanelItem } from "./panel-shell";

/**
 * The grouped language list shared by the audio picker, the embedded-subtitle picker, and the
 * subtitle-download picker. A language with one entry is a single tappable row; one with several
 * expands in place so the variant (SDH, forced, a different release) is a deliberate second pick.
 */
export function LanguageGroupList<TItem>({
  groups,
  hiddenCount,
  showAll,
  onToggleShowAll,
  expanded,
  onToggleExpanded,
  itemKey,
  itemSelected,
  itemLabel,
  itemDescription,
  onSelect,
  busyKey = null,
  emptyNote,
}: {
  groups: LanguageGroup<TItem>[];
  hiddenCount: number;
  showAll: boolean;
  onToggleShowAll: () => void;
  expanded: string | null;
  onToggleExpanded: (languageCode: string) => void;
  itemKey: (item: TItem) => string;
  itemSelected: (item: TItem) => boolean;
  itemLabel: (item: TItem, index: number) => ReactNode;
  itemDescription?: (item: TItem) => ReactNode;
  onSelect: (item: TItem) => void;
  /** Key of the item currently being applied (a download in flight), shown as busy. */
  busyKey?: string | null;
  emptyNote?: ReactNode;
}) {
  return (
    <>
      {groups.length === 0 && emptyNote}
      {groups.map((group) => {
        const single = group.items[0];
        const multiple = group.items.length > 1;
        const open = multiple && expanded === group.language.code;
        return (
          <div key={group.language.code}>
            <PanelItem
              leading={<LanguageFlag language={group.language} />}
              label={group.language.label}
              description={
                multiple
                  ? `${group.items.length} مسارات — اختر واحداً`
                  : single !== undefined
                    ? itemDescription?.(single)
                    : undefined
              }
              selected={group.selected}
              onClick={() =>
                multiple ? onToggleExpanded(group.language.code) : single && onSelect(single)
              }
              trailing={
                multiple ? (
                  <CaretDownIcon
                    size={16}
                    className={cn(
                      "shrink-0 text-white/60 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                ) : undefined
              }
            />
            {open && (
              <div className="ms-6 mb-1 flex flex-col gap-0.5 border-s border-white/10 ps-3">
                {group.items.map((item, index) => {
                  const key = itemKey(item);
                  return (
                    <PanelItem
                      key={key}
                      label={itemLabel(item, index)}
                      description={busyKey === key ? "جارٍ التنزيل…" : itemDescription?.(item)}
                      selected={itemSelected(item)}
                      disabled={busyKey !== null && busyKey !== key}
                      onClick={() => onSelect(item)}
                      className="py-2"
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {(hiddenCount > 0 || showAll) && (
        <PanelItem
          leading={
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/8 text-white/80">
              <GlobeIcon size={20} />
            </span>
          }
          label={showAll ? "عرض اللغات المعتادة فقط" : `عرض كل اللغات (+${hiddenCount})`}
          description={showAll ? undefined : "قد يخطئ التصنيف التلقائي — كل المسارات موجودة هنا"}
          onClick={onToggleShowAll}
          trailing={<span />}
        />
      )}
    </>
  );
}
