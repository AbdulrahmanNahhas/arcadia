import {
  ArrowDownIcon,
  ArrowsDownUpIcon,
  ArrowUpIcon,
  ArticleIcon,
  CalendarBlankIcon,
  CheckIcon,
  FadersHorizontalIcon,
  FloppyDiskIcon,
  GridFourIcon,
  MagnifyingGlassIcon,
  SquaresFourIcon,
  StackIcon,
  TableIcon,
  XIcon,
} from "@phosphor-icons/react";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { groupLabel } from "../grouping";
import type { SavedUserView } from "../model";
import { scoreCriterionLabels } from "../scoring";
import { getSavedViewAccentStyle, getSavedViewIcon } from "../view-meta";
import type {
  GalleryMode,
  GalleryOptions,
  GroupBy,
  Layout,
  Sort,
  SortDirection,
  TableColumnId,
  TableDensity,
} from "../view-types";
import { defaultTableColumns, tableColumnIds } from "../view-types";
import { tableColumnLabels } from "./work-table";

const sortLabels: Record<Sort, string> = {
  title: "العنوان",
  rating: "التقييم",
  recent: "المضاف حديثاً",
  year: "سنة الإصدار",
  creator: "صنّاع العمل",
  audience: "الجمهور",
  kind: "نوع العمل",
  status: "حالة المتابعة",
  progress: "التقدم",
  trackedOn: "تاريخ التتبع",
  story: scoreCriterionLabels.story.ar,
  characters: scoreCriterionLabels.characters.ar,
  depth: scoreCriterionLabels.depth.ar,
  worldBuilding: scoreCriterionLabels.worldBuilding.ar,
  originality: scoreCriterionLabels.originality.ar,
  craft: scoreCriterionLabels.craft.ar,
};

const layoutItems = [
  { id: "gallery", label: "المعرض", icon: GridFourIcon },
  { id: "wide", label: "بطاقات واسعة", icon: ArticleIcon },
  { id: "table", label: "الجدول", icon: TableIcon },
  { id: "timeline", label: "الخط الزمني", icon: CalendarBlankIcon },
] as const;

const galleryModeLabels: Record<Exclude<GalleryMode, "custom">, string> = {
  cover: "الغلاف فقط",
  title: "غلاف وعنوان",
  full: "كامل",
};

const densityLabels: Record<TableDensity, string> = {
  compact: "مضغوط",
  comfortable: "متوازن",
  spacious: "واسع",
};

export function LibraryToolbar({
  activeView,
  search,
  onSearchChange,
  layout,
  onLayoutChange,
  sort,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
  groupBy,
  onGroupByChange,
  filter,
  resultCount,
  savedViews,

  onSavedViewChange,
  onSaveView,
  cardSize,
  onCardSizeChange,
  galleryOptions,
  onGalleryOptionsChange,
  tableColumns,
  onTableColumnsChange,
  tableDensity,
  onTableDensityChange,
  timelineNewestFirst,
  onTimelineOrderChange,
}: {
  activeView?: SavedUserView;
  search: string;
  onSearchChange: (value: string) => void;
  layout: Layout;
  onLayoutChange: (value: Layout) => void;
  sort: Sort;
  sortDirection: SortDirection;
  onSortChange: (value: Sort) => void;
  onSortDirectionChange: (value: SortDirection) => void;
  groupBy: GroupBy;
  onGroupByChange: (value: GroupBy) => void;
  filter: React.ReactNode;
  resultCount: number;
  savedViews: SavedUserView[];

  onSavedViewChange: (id?: string) => void;
  onSaveView: (name: string) => void;
  cardSize: number;
  onCardSizeChange: (value: number) => void;
  galleryOptions: GalleryOptions;
  onGalleryOptionsChange: (value: GalleryOptions) => void;
  tableColumns: TableColumnId[];
  onTableColumnsChange: (value: TableColumnId[]) => void;
  tableDensity: TableDensity;
  onTableDensityChange: (value: TableDensity) => void;
  timelineNewestFirst: boolean;
  onTimelineOrderChange: (value: boolean) => void;
}) {
  return (
    <nav className="border-b border-border/70 bg-background/95 shadow-none backdrop-blur-xl z-100!">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-2.5 py-2.5 sm:px-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2 lg:flex-1">
          <ViewsSelector
            views={savedViews}
            activeView={activeView}
            resultCount={resultCount}
            onApply={onSavedViewChange}
            onSave={onSaveView}
          />

          <SearchControl
            search={search}
            onSearchChange={onSearchChange}
            className="hidden min-w-48 flex-1 sm:block lg:max-w-xl"
          />

          <div className="ms-auto flex shrink-0 items-center gap-1">
            <DisplayOptions
              layout={layout}
              onLayoutChange={onLayoutChange}
              cardSize={cardSize}
              onCardSizeChange={onCardSizeChange}
              galleryOptions={galleryOptions}
              onGalleryOptionsChange={onGalleryOptionsChange}
              tableColumns={tableColumns}
              onTableColumnsChange={onTableColumnsChange}
              tableDensity={tableDensity}
              onTableDensityChange={onTableDensityChange}
              timelineNewestFirst={timelineNewestFirst}
              onTimelineOrderChange={onTimelineOrderChange}
            />
          </div>
        </div>

        <SearchControl search={search} onSearchChange={onSearchChange} className="sm:hidden" />

        <div className="flex min-w-0 items-center gap-2 lg:shrink-0">
          <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
            <div className="flex w-max items-center gap-2 pe-2">
              {filter}
              <SortControl
                sort={sort}
                direction={sortDirection}
                onSortChange={onSortChange}
                onDirectionChange={onSortDirectionChange}
              />
              {layout !== "timeline" && (
                <GroupControl groupBy={groupBy} onGroupByChange={onGroupByChange} />
              )}
            </div>
          </div>

          <LayoutControl
            layout={layout}
            onLayoutChange={onLayoutChange}
            className="hidden shrink-0 md:flex"
          />
        </div>
      </div>
    </nav>
  );
}

const groupOptions: GroupBy[] = [
  "none",
  "audience",
  "rating",
  "kind",
  "status",
  "year",
  "genre",
  "depth",
  "craft",
];

function GroupControl({
  groupBy,
  onGroupByChange,
}: {
  groupBy: GroupBy;
  onGroupByChange: (value: GroupBy) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <StackIcon data-icon="inline-start" />
        {groupLabel(groupBy)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>تجميع النتائج حسب</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={groupBy}
            onValueChange={(value) => onGroupByChange(value as GroupBy)}
          >
            {groupOptions.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {groupLabel(option)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchControl({
  search,
  onSearchChange,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <MagnifyingGlassIcon className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="ابحث بالعنوان، المنشئ، النوع، الوسوم…"
        aria-label="البحث في المجموعة"
        className="h-10 border-transparent bg-muted/60 ps-10 pe-9 focus-visible:border-input focus-visible:bg-background sm:h-9"
      />
      {search && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute inset-s-1 top-1/2 -translate-y-1/2"
          onClick={() => onSearchChange("")}
          aria-label="مسح البحث"
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}

function LayoutControl({
  layout,
  onLayoutChange,
  className,
}: {
  layout: Layout;
  onLayoutChange: (value: Layout) => void;
  className?: string;
}) {
  return (
    <SingleToggleGroup
      value={layout}
      onValueChange={(value) => onLayoutChange(value as Layout)}
      ariaLabel="طريقة عرض النتائج"
      className={className}
    >
      {layoutItems.map((item) => (
        <ToggleGroupItem key={item.id} value={item.id} aria-label={item.label}>
          <item.icon />
        </ToggleGroupItem>
      ))}
    </SingleToggleGroup>
  );
}

function SingleToggleGroup({
  value,
  onValueChange,
  ariaLabel,
  className,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values) => {
        const next = values[0];
        if (next) onValueChange(String(next));
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </ToggleGroup>
  );
}

function SortControl({
  sort,
  direction,
  onSortChange,
  onDirectionChange,
}: {
  sort: Sort;
  direction: SortDirection;
  onSortChange: (value: Sort) => void;
  onDirectionChange: (value: SortDirection) => void;
}) {
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="rounded-e-none!" />}
        >
          <ArrowsDownUpIcon data-icon="inline-start" />
          {sortLabels[sort]}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>الترتيب حسب</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => onSortChange(value as Sort)}
            >
              {(Object.keys(sortLabels) as Sort[]).map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {sortLabels[option]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        size="icon-sm"
        className="rounded-s-none! border-s-0"
        onClick={() => onDirectionChange(direction === "asc" ? "desc" : "asc")}
        aria-label={direction === "asc" ? "ترتيب تصاعدي" : "ترتيب تنازلي"}
        title={direction === "asc" ? "تصاعدي" : "تنازلي"}
      >
        {direction === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />}
      </Button>
    </div>
  );
}

function ViewOption({
  icon,
  accentStyle,
  title,
  subtitle,
  active,
}: {
  icon: React.ReactNode;
  accentStyle?: React.CSSProperties;
  title: string;
  subtitle?: string;
  active: boolean;
}) {
  return (
    <>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted"
        style={accentStyle}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="w-full truncate">{title}</span>
        {subtitle ? (
          <span className="w-full truncate text-[10px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {active ? <CheckIcon className="size-4 shrink-0 text-primary" weight="bold" /> : null}
    </>
  );
}

function ViewsSelector({
  views,
  activeView,
  resultCount,
  onApply,
  onSave,
}: {
  views: SavedUserView[];
  activeView?: SavedUserView;
  resultCount: number;
  onApply: (id?: string) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const ActiveIcon = activeView ? getSavedViewIcon(activeView.icon) : SquaresFourIcon;
  const save = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className="h-10 max-w-56 min-w-0 flex-1 border border-border justify-start bg-muted/60 pr-2 pl-3 sm:max-w-72 lg:flex-none rounded-full"
            aria-label="تبديل العرض"
          />
        }
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-xl border"
          style={activeView ? getSavedViewAccentStyle(activeView.color) : undefined}
        >
          <ActiveIcon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start justify-start text-start leading-tight">
          <span className="w-full truncate font-medium">{activeView?.name ?? "كل الأعمال"}</span>
          <span className="w-full truncate text-[10px] text-muted-foreground">
            {resultCount} نتيجة
          </span>
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[calc(100vw-1.5rem)] max-w-88 gap-0 overflow-hidden p-0"
      >
        <PopoverHeader className="p-4 pb-3">
          <PopoverTitle>انتقل إلى عرض</PopoverTitle>
          <PopoverDescription className="text-xs">
            كل عرض هو مساحة حية تحفظ الفلاتر والترتيب والشكل.
          </PopoverDescription>
        </PopoverHeader>

        <Command className="bg-transparent" loop>
          <div className="px-3 pb-2">
            <CommandInput placeholder="ابحث عن عرض…" className="h-9" />
          </div>
          <Separator />
          <CommandList className="max-h-64 p-2">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              لا توجد نتائج مطابقة
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-works كل الأعمال"
                className="h-auto gap-2 py-2.5"
                onSelect={() => {
                  onApply();
                  setOpen(false);
                }}
              >
                <ViewOption
                  icon={<SquaresFourIcon />}
                  title="كل الأعمال"
                  subtitle="المكتبة من دون فلاتر محفوظة"
                  active={!activeView}
                />
              </CommandItem>

              {views.map((savedView) => {
                const Icon = getSavedViewIcon(savedView.icon);
                const layoutLabel = layoutItems.find((item) => item.id === savedView.layout)?.label;
                return (
                  <CommandItem
                    key={savedView.id}
                    value={`${savedView.name} ${layoutLabel ?? ""}`}
                    className="h-auto gap-2 py-2.5"
                    onSelect={() => {
                      onApply(savedView.id);
                      setOpen(false);
                    }}
                  >
                    <ViewOption
                      icon={<Icon />}
                      accentStyle={getSavedViewAccentStyle(savedView.color)}
                      title={savedView.name}
                      subtitle={[layoutLabel, savedView.isPinned && "رئيسي"]
                        .filter(Boolean)
                        .join(" · ")}
                      active={activeView?.id === savedView.id}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>

        <Separator />
        <FieldGroup className="gap-2 p-3">
          <Field>
            <FieldLabel htmlFor="saved-view-name" className="sr-only">
              اسم العرض
            </FieldLabel>
            <Input
              id="saved-view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && save()}
              placeholder="احفظ الإعداد الحالي باسم…"
              className="h-9"
            />
          </Field>
          <Button size="sm" onClick={save} disabled={!name.trim()}>
            <FloppyDiskIcon data-icon="inline-start" />
            إنشاء عرض جديد
          </Button>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function DisplayOptions({
  layout,
  onLayoutChange,
  cardSize,
  onCardSizeChange,
  galleryOptions,
  onGalleryOptionsChange,
  tableColumns,
  onTableColumnsChange,
  tableDensity,
  onTableDensityChange,
  timelineNewestFirst,
  onTimelineOrderChange,
}: {
  layout: Layout;
  onLayoutChange: (value: Layout) => void;
  cardSize: number;
  onCardSizeChange: (value: number) => void;
  galleryOptions: GalleryOptions;
  onGalleryOptionsChange: (value: GalleryOptions) => void;
  tableColumns: TableColumnId[];
  onTableColumnsChange: (value: TableColumnId[]) => void;
  tableDensity: TableDensity;
  onTableDensityChange: (value: TableDensity) => void;
  timelineNewestFirst: boolean;
  onTimelineOrderChange: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const setGalleryField = <TKey extends keyof GalleryOptions>(
    key: TKey,
    value: GalleryOptions[TKey],
  ) =>
    onGalleryOptionsChange({
      ...galleryOptions,
      [key]: value,
      mode:
        key === "mode"
          ? (value as GalleryMode)
          : [
                "showTitle",
                "showFavorite",
                "showCreator",
                "showYear",
                "showGenres",
                "showProgress",
              ].includes(String(key))
            ? "custom"
            : galleryOptions.mode,
    });

  const applyGalleryMode = (mode: Exclude<GalleryMode, "custom">) => {
    const visibility =
      mode === "cover"
        ? {
            showTitle: false,
            showFavorite: false,
            showCreator: false,
            showYear: false,
            showGenres: false,
            showProgress: false,
          }
        : mode === "title"
          ? {
              showTitle: true,
              showFavorite: true,
              showCreator: false,
              showYear: false,
              showGenres: false,
              showProgress: false,
            }
          : {
              showTitle: true,
              showFavorite: true,
              showCreator: false,
              showYear: true,
              showGenres: true,
              showProgress: false,
            };
    onGalleryOptionsChange({ ...galleryOptions, ...visibility, mode });
  };

  const toggleColumn = (column: TableColumnId, checked: boolean) => {
    if (checked) {
      onTableColumnsChange(
        tableColumnIds.filter(
          (candidate) => candidate === column || tableColumns.includes(candidate),
        ),
      );
      return;
    }
    if (tableColumns.length === 1) return;
    onTableColumnsChange(tableColumns.filter((item) => item !== column));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="sm:size-9"
            aria-label={`خيارات عرض ${layoutItems.find((item) => item.id === layout)?.label}`}
            onClickCapture={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          />
        }
      >
        <FadersHorizontalIcon />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(78vh,42rem)] w-[calc(100vw-1.5rem)] max-w-96 overflow-y-auto"
      >
        <PopoverHeader>
          <PopoverTitle>إعدادات العرض</PopoverTitle>
          <PopoverDescription>خصّص التخطيط الحالي والمعلومات الظاهرة.</PopoverDescription>
        </PopoverHeader>

        <FieldSet>
          <FieldLegend variant="label">التخطيط</FieldLegend>
          <LayoutControl layout={layout} onLayoutChange={onLayoutChange} />
        </FieldSet>

        <Separator />

        {(layout === "gallery" || layout === "wide") && (
          <div className="flex flex-col gap-5">
            <FieldSet>
              <FieldLegend variant="label">نمط البطاقة</FieldLegend>
              <SingleToggleGroup
                value={galleryOptions.mode}
                onValueChange={(value) =>
                  value !== "custom" && applyGalleryMode(value as Exclude<GalleryMode, "custom">)
                }
                ariaLabel="نمط تفاصيل بطاقة المعرض"
                className="flex-wrap"
              >
                {(Object.keys(galleryModeLabels) as Array<Exclude<GalleryMode, "custom">>).map(
                  (mode) => (
                    <ToggleGroupItem key={mode} value={mode}>
                      {galleryModeLabels[mode]}
                    </ToggleGroupItem>
                  ),
                )}
              </SingleToggleGroup>
              {galleryOptions.mode === "custom" && (
                <Badge variant="secondary" className="w-fit">
                  تخصيص يدوي
                </Badge>
              )}
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">الصورة</FieldLegend>
              <SingleToggleGroup
                value={galleryOptions.imageType}
                onValueChange={(value) =>
                  setGalleryField("imageType", value as GalleryOptions["imageType"])
                }
                ariaLabel="نوع صورة البطاقة"
              >
                <ToggleGroupItem value="poster">الملصق</ToggleGroupItem>
                <ToggleGroupItem value="logo">الشعار</ToggleGroupItem>
              </SingleToggleGroup>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="gallery-card-size" className="justify-between">
                <span>حجم البطاقة</span>
                <span className="text-muted-foreground">{cardSize}px</span>
              </FieldLabel>
              <Slider
                id="gallery-card-size"
                aria-label="حجم بطاقة المعرض"
                value={[cardSize]}
                min={110}
                max={layout === "wide" ? 300 : 220}
                step={2}
                onValueChange={(value) =>
                  onCardSizeChange(typeof value === "number" ? value : (value[0] ?? cardSize))
                }
              />
            </Field>

            <FieldSet>
              <FieldLegend variant="label">المعلومات الظاهرة</FieldLegend>
              <FieldGroup className="gap-3">
                <DisplaySwitch
                  label="العنوان"
                  checked={galleryOptions.showTitle}
                  onCheckedChange={(checked) => setGalleryField("showTitle", checked)}
                />
                <DisplaySwitch
                  label="علامة المفضلة"
                  checked={galleryOptions.showFavorite}
                  onCheckedChange={(checked) => setGalleryField("showFavorite", checked)}
                />
                <DisplaySwitch
                  label="المنشئ"
                  checked={galleryOptions.showCreator}
                  onCheckedChange={(checked) => setGalleryField("showCreator", checked)}
                />
                <DisplaySwitch
                  label="سنة الإصدار"
                  checked={galleryOptions.showYear}
                  onCheckedChange={(checked) => setGalleryField("showYear", checked)}
                />
                <DisplaySwitch
                  label="التصنيفات"
                  checked={galleryOptions.showGenres}
                  onCheckedChange={(checked) => setGalleryField("showGenres", checked)}
                />
                <DisplaySwitch
                  label="التقدم"
                  checked={galleryOptions.showProgress}
                  onCheckedChange={(checked) => setGalleryField("showProgress", checked)}
                />
                <DisplaySwitch
                  label="شارة نوع العمل فوق الصورة"
                  checked={galleryOptions.showType}
                  onCheckedChange={(checked) => setGalleryField("showType", checked)}
                />
                <DisplaySwitch
                  label="شارة التقييم فوق الصورة"
                  checked={galleryOptions.showRating}
                  onCheckedChange={(checked) => setGalleryField("showRating", checked)}
                />
              </FieldGroup>
            </FieldSet>
          </div>
        )}

        {layout === "table" && (
          <div className="flex flex-col gap-5">
            <FieldSet>
              <FieldLegend variant="label">كثافة الصفوف</FieldLegend>
              <SingleToggleGroup
                value={tableDensity}
                onValueChange={(value) => onTableDensityChange(value as TableDensity)}
                ariaLabel="كثافة صفوف الجدول"
              >
                {(Object.keys(densityLabels) as TableDensity[]).map((density) => (
                  <ToggleGroupItem key={density} value={density}>
                    {densityLabels[density]}
                  </ToggleGroupItem>
                ))}
              </SingleToggleGroup>
            </FieldSet>

            <FieldSet>
              <div className="flex items-center justify-between gap-2">
                <FieldLegend variant="label" className="mb-0">
                  الأعمدة الظاهرة
                </FieldLegend>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onTableColumnsChange(defaultTableColumns)}
                  >
                    افتراضي
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onTableColumnsChange([...tableColumnIds])}
                  >
                    إظهار الكل
                  </Button>
                </div>
              </div>
              <FieldGroup data-slot="checkbox-group" className="grid grid-cols-2 gap-3">
                {tableColumnIds.map((column) => {
                  const checked = tableColumns.includes(column);
                  return (
                    <Field key={column} orientation="horizontal">
                      <Checkbox
                        id={`table-column-${column}`}
                        checked={checked}
                        disabled={checked && tableColumns.length === 1}
                        onCheckedChange={(value) => toggleColumn(column, Boolean(value))}
                      />
                      <FieldLabel htmlFor={`table-column-${column}`}>
                        {tableColumnLabels[column]}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </FieldGroup>
            </FieldSet>
          </div>
        )}

        {layout === "timeline" && (
          <DisplaySwitch
            label="الأحدث أولاً"
            checked={timelineNewestFirst}
            onCheckedChange={onTimelineOrderChange}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function DisplaySwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
}
