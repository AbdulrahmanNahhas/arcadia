import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BookmarkSimpleIcon,
  CheckCircleIcon,
  FloppyDiskIcon,
  HouseLineIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type {
  SavedUserView,
  UpdateSavedUserView,
} from "@/features/library/model"
import {
  getSavedViewAccentStyle,
  getSavedViewIcon,
  savedViewColorOptions,
  savedViewIconOptions,
} from "@/features/library/view-meta"
import {
  editSavedView,
  getSavedViews,
  removeSavedView,
} from "@/server/library.functions"

const layoutLabels: Record<SavedUserView["layout"], string> = {
  gallery: "معرض",
  table: "جدول",
  timeline: "خط زمني",
  statistics: "إحصاءات",
}

const sortLabels: Record<SavedUserView["sort"], string> = {
  title: "العنوان",
  rating: "التقييم",
  recent: "المضاف حديثاً",
  year: "سنة الإصدار",
}

const sortDirectionLabels: Record<SavedUserView["sortDirection"], string> = {
  asc: "تصاعدي",
  desc: "تنازلي",
}

function createDraft(view: SavedUserView): UpdateSavedUserView {
  return {
    id: view.id,
    name: view.name,
    description: view.description,
    icon: view.icon,
    color: view.color,
    layout: view.layout,
    sort: view.sort,
    sortDirection: view.sortDirection,
    isPinned: view.isPinned,
  }
}

export function ViewsManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<UpdateSavedUserView | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const {
    data: views = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["saved-views"],
    queryFn: () => getSavedViews(),
    enabled: open,
  })

  const selectedView =
    views.find((view) => view.id === selectedId) ?? views.at(0)

  const editMutation = useMutation({
    mutationFn: (input: UpdateSavedUserView) => editSavedView({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["saved-views"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeSavedView({ data: { id } }),
    onSuccess: async (_, deletedId) => {
      setConfirmingId(null)
      const nextView = views.find((view) => view.id !== deletedId)
      setSelectedId(nextView?.id ?? null)
      setDraft(nextView ? createDraft(nextView) : null)
      await queryClient.invalidateQueries({ queryKey: ["saved-views"] })
    },
  })

  useEffect(() => {
    if (!open || views.length === 0) return
    if (!selectedId || !views.some((view) => view.id === selectedId)) {
      setSelectedId(views[0].id)
    }
  }, [open, selectedId, views])

  useEffect(() => {
    if (selectedView) setDraft(createDraft(selectedView))
  }, [selectedView])

  const updateDraft = <TKey extends keyof UpdateSavedUserView>(
    key: TKey,
    value: UpdateSavedUserView[TKey]
  ) => {
    editMutation.reset()
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  const handleSelect = (view: SavedUserView) => {
    setSelectedId(view.id)
    setDraft(createDraft(view))
    setConfirmingId(null)
    editMutation.reset()
    deleteMutation.reset()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmingId(null)
      editMutation.reset()
      deleteMutation.reset()
    }
    onOpenChange(nextOpen)
  }

  const nameIsInvalid = draft?.name.trim().length === 0
  const hasChanges =
    draft && selectedView
      ? JSON.stringify(draft) !== JSON.stringify(createDraft(selectedView))
      : false

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft || nameIsInvalid) return
    editMutation.mutate({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="h-[min(92svh,52rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>إدارة العروض المحفوظة</DialogTitle>
          <DialogDescription>
            عدّل هوية كل عرض وطريقة ترتيبه، واختر ما يظهر منها في الصفحة
            الرئيسية.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            جارٍ تحميل العروض…
          </p>
        ) : isError ? (
          <Alert variant="destructive">
            <WarningCircleIcon />
            <AlertTitle>تعذر تحميل العروض</AlertTitle>
            <AlertDescription>
              أغلق النافذة وحاول فتحها مرة أخرى.
            </AlertDescription>
          </Alert>
        ) : views.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookmarkSimpleIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد عروض محفوظة</EmptyTitle>
              <EmptyDescription>
                ستظهر هنا العروض التي تحفظها من المكتبة.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1">
            <aside className="flex max-h-44 flex-col gap-1 overflow-y-auto border-b bg-muted/20 p-2 md:max-h-none md:border-e md:border-b-0">
              {views.map((view) => {
                const Icon = getSavedViewIcon(view.icon)
                const isSelected = selectedView?.id === view.id

                return (
                  <Button
                    key={view.id}
                    type="button"
                    variant={isSelected ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start rounded-xl px-3 py-2.5 text-start"
                    onClick={() => handleSelect(view)}
                    aria-pressed={isSelected}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg border"
                      style={getSavedViewAccentStyle(view.color)}
                    >
                      <Icon data-icon="inline-start" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {view.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {view.description || layoutLabels[view.layout]}
                      </span>
                    </span>
                    {view.isPinned && (
                      <Badge variant="secondary">
                        <HouseLineIcon data-icon="inline-start" />
                        مروّج
                      </Badge>
                    )}
                  </Button>
                )
              })}
            </aside>

            {draft && selectedView ? (
              <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                  <FieldGroup className="gap-6">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const SelectedIcon = getSavedViewIcon(draft.icon)
                        return (
                          <span
                            className="flex size-11 shrink-0 items-center justify-center rounded-xl border"
                            style={getSavedViewAccentStyle(draft.color)}
                          >
                            <SelectedIcon />
                          </span>
                        )
                      })()}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{draft.name}</p>
                        <p className="text-xs text-muted-foreground">
                          هوية العرض وإعدادات ظهوره
                        </p>
                      </div>
                    </div>

                    <FieldGroup className="gap-5 sm:grid sm:grid-cols-2">
                      <Field data-invalid={nameIsInvalid || undefined}>
                        <FieldLabel htmlFor="saved-view-name">الاسم</FieldLabel>
                        <Input
                          id="saved-view-name"
                          value={draft.name}
                          maxLength={100}
                          aria-invalid={nameIsInvalid || undefined}
                          onChange={(event) =>
                            updateDraft("name", event.target.value)
                          }
                        />
                        {nameIsInvalid && (
                          <FieldError>أدخل اسماً واضحاً للعرض.</FieldError>
                        )}
                      </Field>

                      <Field className="sm:col-span-2">
                        <FieldLabel htmlFor="saved-view-description">
                          الوصف
                        </FieldLabel>
                        <Textarea
                          id="saved-view-description"
                          value={draft.description}
                          maxLength={240}
                          rows={3}
                          placeholder="صف بإيجاز ما يجمعه هذا العرض…"
                          onChange={(event) =>
                            updateDraft("description", event.target.value)
                          }
                        />
                        <FieldDescription>
                          {draft.description.length}/240 حرفاً
                        </FieldDescription>
                      </Field>
                    </FieldGroup>

                    <FieldSet>
                      <FieldLegend variant="label">الأيقونة</FieldLegend>
                      <ToggleGroup
                        value={[draft.icon]}
                        multiple={false}
                        variant="outline"
                        className="w-full flex-wrap justify-start"
                        aria-label="أيقونة العرض"
                        onValueChange={(values) => {
                          const icon = values[0]
                          if (icon) {
                            updateDraft(
                              "icon",
                              icon as UpdateSavedUserView["icon"]
                            )
                          }
                        }}
                      >
                        {savedViewIconOptions.map((option) => (
                          <ToggleGroupItem
                            key={option.id}
                            value={option.id}
                            aria-label={option.label}
                            title={option.label}
                          >
                            <option.icon data-icon="inline-start" />
                            <span className="sr-only">{option.label}</span>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FieldSet>

                    <FieldSet>
                      <FieldLegend variant="label">اللون</FieldLegend>
                      <ToggleGroup
                        value={[draft.color]}
                        multiple={false}
                        variant="outline"
                        className="w-full flex-wrap justify-start"
                        aria-label="لون العرض"
                        onValueChange={(values) => {
                          const color = values[0]
                          if (color) {
                            updateDraft(
                              "color",
                              color as UpdateSavedUserView["color"]
                            )
                          }
                        }}
                      >
                        {savedViewColorOptions.map((option) => (
                          <ToggleGroupItem
                            key={option.id}
                            value={option.id}
                            style={getSavedViewAccentStyle(option.id)}
                          >
                            {option.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FieldSet>

                    <FieldGroup className="gap-5 sm:grid sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="saved-view-layout">
                          التخطيط
                        </FieldLabel>
                        <Select
                          value={draft.layout}
                          onValueChange={(value) => {
                            if (value) {
                              updateDraft("layout", value)
                            }
                          }}
                        >
                          <SelectTrigger
                            id="saved-view-layout"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.entries(layoutLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="saved-view-sort">
                          ترتيب حسب
                        </FieldLabel>
                        <Select
                          value={draft.sort}
                          onValueChange={(value) => {
                            if (value) {
                              updateDraft("sort", value)
                            }
                          }}
                        >
                          <SelectTrigger
                            id="saved-view-sort"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.entries(sortLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="saved-view-sort-direction">
                          اتجاه الترتيب
                        </FieldLabel>
                        <Select
                          value={draft.sortDirection}
                          onValueChange={(value) => {
                            if (value) {
                              updateDraft("sortDirection", value)
                            }
                          }}
                        >
                          <SelectTrigger
                            id="saved-view-sort-direction"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.entries(sortDirectionLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field
                        orientation="horizontal"
                        className="rounded-xl border bg-muted/20 p-4"
                      >
                        <FieldContent>
                          <FieldTitle>الترويج في الرئيسية</FieldTitle>
                          <FieldDescription>
                            اعرض هذا العرض ضمن اختصارات الصفحة الرئيسية.
                          </FieldDescription>
                        </FieldContent>
                        <Switch
                          id="saved-view-pinned"
                          checked={draft.isPinned}
                          onCheckedChange={(checked) =>
                            updateDraft("isPinned", checked)
                          }
                          aria-label="الترويج في الصفحة الرئيسية"
                        />
                      </Field>
                    </FieldGroup>

                    {editMutation.isSuccess && (
                      <Alert>
                        <CheckCircleIcon />
                        <AlertTitle>تم حفظ التعديلات</AlertTitle>
                        <AlertDescription>
                          تحدّث العرض في المكتبة والصفحة الرئيسية.
                        </AlertDescription>
                      </Alert>
                    )}

                    {editMutation.isError && (
                      <Alert variant="destructive">
                        <WarningCircleIcon />
                        <AlertTitle>تعذر حفظ العرض</AlertTitle>
                        <AlertDescription>
                          لم تُحفظ تعديلاتك. تحقق من الحقول وحاول مرة أخرى.
                        </AlertDescription>
                      </Alert>
                    )}

                    {deleteMutation.isError && (
                      <Alert variant="destructive">
                        <WarningCircleIcon />
                        <AlertTitle>تعذر حذف العرض</AlertTitle>
                        <AlertDescription>
                          بقي العرض محفوظاً. حاول الحذف مرة أخرى.
                        </AlertDescription>
                      </Alert>
                    )}
                  </FieldGroup>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  {confirmingId === selectedView.id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(selectedView.id)}
                      >
                        <TrashIcon data-icon="inline-start" />
                        {deleteMutation.isPending
                          ? "جارٍ الحذف…"
                          : "تأكيد الحذف"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => setConfirmingId(null)}
                      >
                        إلغاء
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        deleteMutation.reset()
                        setConfirmingId(selectedView.id)
                      }}
                    >
                      <TrashIcon data-icon="inline-start" />
                      حذف العرض
                    </Button>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      editMutation.isPending || nameIsInvalid || !hasChanges
                    }
                  >
                    <FloppyDiskIcon data-icon="inline-start" />
                    {editMutation.isPending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
