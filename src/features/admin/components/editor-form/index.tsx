"use client"

import { useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { InfoIcon, CodeIcon, CheckIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

import { kindLabels } from "@/features/library/filtering"
import {
  audiences,
  countries,
  genres,
  tagLabelsAr,
  taxonomyLabels,
  tones,
  workKinds,
} from "@/features/library/model"
import {
  calculatedRating,
  scoreCriteria,
  scoreLabel,
  scoreWeights,
} from "@/features/library/scoring"
import { fieldAppliesToKind } from "@/features/library/work-kind-fields"
import { useArabicTranslations } from "@/features/library/translations"
import type {
  AdminWorkUpdate,
  Work,
  WorkKind,
  WorkStructure,
} from "@/features/library/model"
import { getWorkStructure, saveWork } from "@/server/library.functions"
import { RelationshipEditor } from "./relationship"
import { Field } from "./fields/field"
import { ArrayField } from "./fields/array-field"
import { CreditField } from "./fields/credit-field"
import { ContentField } from "./fields/content-field"
import { RiskSelect } from "./fields/risk-select"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

interface WorkEditorProps {
  work: Work | null
  works: Work[]
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}

export function WorkEditor({
  work,
  works,
  onOpenChange,
  onSaved,
}: WorkEditorProps) {
  if (!work) return null

  return (
    <WorkEditorInner
      key={work.id}
      work={work}
      works={works}
      open={Boolean(work)}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  )
}

function WorkEditorInner({
  work,
  works,
  open,
  onOpenChange,
  onSaved,
}: {
  work: Work
  works: Work[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [draft, setDraft] = useState<Work>(() => structuredClone(work))
  const [links, setLinks] = useState(() =>
    work.externalLinks
      .map((link) => `${link.provider} | ${link.label} | ${link.url}`)
      .join("\n")
  )
  const structureQuery = useQuery({
    queryKey: ["work-structure", work.id],
    queryFn: () => getWorkStructure({ data: { workId: work.id } }),
  })

  const mutation = useMutation({
    mutationFn: saveWork,
    onSuccess: async () => {
      await onSaved()
      onOpenChange(false)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const {
      addedAt: _addedAt,
      palette: _palette,
      calculatedRating: _calculatedRating,
      relations,
      ...editable
    } = draft

    const externalLinks = links
      .split("\n")
      .map((line) => line.split("|").map((value) => value.trim()))
      .filter((parts) => parts.length >= 3 && parts[2])
      .map(([provider, label, ...url]) => ({
        provider,
        label,
        url: url.join("|"),
      }))

    mutation.mutate({
      data: {
        ...editable,
        externalLinks,
        relations: relations.map(
          ({ workId, relationType, direction, notes }) => ({
            workId,
            relationType,
            direction,
            notes,
          })
        ),
      } as AdminWorkUpdate,
    })
  }

  const title = `تعديل ${work.arabicTitle || work.title}`
  const description =
    "البيانات الوصفية والحالة الشخصية والإرشادات والروابط والملفات المحلية."

  const formFields = (
    <WorkEditorFormFields
      work={work}
      works={works}
      draft={draft}
      setDraft={setDraft}
      links={links}
      setLinks={setLinks}
      mutation={mutation}
      structure={structureQuery.data}
      submit={submit}
    />
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          dir="rtl"
          className="flex h-[min(92dvh,56rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none -translate-x-1/2 flex-col gap-0 overflow-hidden rounded-xl! bg-background p-0 text-foreground sm:max-w-none lg:w-[min(72rem,calc(100vw-3rem))]"
        >
          <DialogHeader className="z-10 shrink-0 border-e-4 border-b border-border border-e-amber-500 p-4 text-right shadow-sm">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>

          {formFields}

          <DialogFooter className="flex shrink-0 flex-row items-center justify-end gap-2 border-t border-border/60 bg-background p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              form="admin-editor-form"
              size="sm"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[90vh] flex-col gap-0 bg-background p-0 text-foreground">
        <DrawerHeader className="shrink-0 border-b border-border/60 p-6 text-right">
          <DrawerTitle className="text-xl font-bold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground">
            {description}
          </DrawerDescription>
        </DrawerHeader>

        {formFields}

        <DrawerFooter className="flex shrink-0 flex-row items-center justify-end gap-2 border-t border-border/60 bg-background p-4">
          <DrawerClose
            render={
              <Button type="button" variant="outline" size="sm">
                إلغاء
              </Button>
            }
          />
          <Button
            type="submit"
            form="admin-editor-form"
            size="sm"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function WorkEditorFormFields({
  work,
  works,
  draft,
  setDraft,
  links,
  setLinks,
  mutation,
  structure,
  submit,
}: {
  work: Work
  works: Work[]
  draft: Work
  setDraft: React.Dispatch<React.SetStateAction<Work>>
  links: string
  setLinks: React.Dispatch<React.SetStateAction<string>>
  mutation: any
  structure?: WorkStructure
  submit: (e: FormEvent) => void
}) {
  const { taxonomyLabel } = useArabicTranslations()
  const applies = (field: Parameters<typeof fieldAppliesToKind>[1]) =>
    fieldAppliesToKind(draft.kind, field)
  const showRuntime = applies("runtimeMinutes")
  const showPlaytime = applies("playtimeMinutes")
  const showPages = applies("pageCount")
  const showEpisodes = applies("episodeCount")
  const showChapters = applies("chapterCount")
  const showVolumes = applies("volumeCount")
  const showRoutes = applies("routeCount")
  const showPublication = applies("publication")
  const showSerialization = applies("serialization")

  const emptyPublication: NonNullable<Work["publication"]> = {
    format: null,
    publisher: null,
    imprint: null,
    serialization: [],
    contents: [],
  }

  const updatePublication = (
    changes: Partial<NonNullable<Work["publication"]>>
  ) => {
    setDraft({
      ...draft,
      publication: { ...(draft.publication ?? emptyPublication), ...changes },
    })
  }

  const changeKind = (kind: WorkKind) => setDraft({ ...draft, kind })
  const tagOptions = useMemo(
    () => [...new Set(works.flatMap((candidate) => candidate.tags))].sort(),
    [works]
  )

  return (
    <form
      id="admin-editor-form"
      className="grid min-h-0 flex-1 grid-cols-1 items-start gap-6 overflow-y-auto p-6 lg:grid-cols-2"
      onSubmit={submit}
    >
      <div className="lg:col-span-2">
        <EditorSection
          title="البنية والتتبع"
          description="مقاييس العمل الأساسية وسجل المواسم والوحدات المنظّم. يُحفظ التقدم مقابل هذه الوحدات الثابتة."
        >
          {showRuntime && (
            <Field label="مدة العرض (بالدقائق)">
              <Input
                type="number"
                min="0"
                value={draft.runtimeMinutes ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    runtimeMinutes: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </Field>
          )}
          {showPlaytime && (
            <Field label="مدة اللعب التقديرية (بالدقائق)">
              <Input
                type="number"
                min="0"
                value={draft.playtimeMinutes ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    playtimeMinutes: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </Field>
          )}
          {showPages && (
            <Field label="عدد الصفحات">
              <Input
                type="number"
                min="0"
                value={draft.pageCount ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pageCount: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Field>
          )}
          {showEpisodes && (
            <Field label="عدد الحلقات">
              <Input
                type="number"
                min="0"
                value={draft.episodeCount ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    episodeCount: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </Field>
          )}
          {showChapters && (
            <Field label="عدد الفصول">
              <Input
                type="number"
                min="0"
                value={draft.chapterCount ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    chapterCount: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </Field>
          )}
          {showVolumes && (
            <Field label="عدد المجلدات">
              <Input
                type="number"
                min="0"
                value={draft.volumeCount ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    volumeCount: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </Field>
          )}
          {showRoutes && (
            <Field label="عدد المسارات">
              <Input
                type="number"
                min="0"
                value={draft.routeCount ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    routeCount: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </Field>
          )}
          <StructureSummary structure={structure} />
        </EditorSection>
      </div>

      {/* Identity Section */}
      <EditorSection
        title="الهوية"
        description="الحقول الأساسية المستخدمة في جميع أنحاء أركاديا."
      >
        <Field label="العنوان الأصلي">
          <Input
            value={draft.title}
            required
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>

        <Field label="العنوان العربي">
          <Input
            dir="rtl"
            lang="ar"
            value={draft.arabicTitle ?? ""}
            placeholder="العنوان العربي الموثوق، إن وجد"
            onChange={(event) =>
              setDraft({
                ...draft,
                arabicTitle: event.target.value || null,
              })
            }
          />
        </Field>

        <Field label="النوع">
          <Select
            value={draft.kind}
            onValueChange={(value) => changeKind(value as WorkKind)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {workKinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kindLabels[kind]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field label="سنة الإصدار">
          <Input
            type="number"
            value={draft.year ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                year: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>

        <Field label="حالة الإصدار">
          <Select
            value={draft.releaseStatus}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                releaseStatus: value as Work["releaseStatus"],
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {["announced", "releasing", "released", "ended", "unknown"].map(
                  (status) => (
                    <SelectItem
                      key={status}
                      value={status}
                      className="capitalize"
                    >
                      {taxonomyLabel("release-status", status)}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <ArrayField
          label="العناوين البديلة"
          value={draft.aliases}
          onChange={(aliases: string[]) => setDraft({ ...draft, aliases })}
        />

        <Field label="الملخص" wide>
          <Textarea
            dir="rtl"
            lang="ar"
            rows={5}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            className="resize-y"
          />
        </Field>
      </EditorSection>

      {/* Hidden - do not delete or edit for now
      <div className="lg:col-span-1">
        <EditorSection
          title="Current tracking"
          description="Progress, status, and date are saved together as a chronological checkpoint."
        >
          <div className="col-span-full">
            <TrackingForm work={work} structure={structure} compact />
          </div>
        </EditorSection>
      </div>

      // Note: Favorite is only on the work dialog
        */}

      {/* Classification Section */}
      <EditorSection
        title="التصنيف"
        description="تتحول القيم المفصولة بفواصل إلى فلاتر قابلة للبحث."
      >
        <ArrayField
          label="التصنيفات"
          value={draft.genres}
          onChange={(nextGenres: string[]) =>
            setDraft({ ...draft, genres: nextGenres })
          }
          options={genres}
          optionLabels={taxonomyLabels.genres}
          maxItems={4}
        />
        <ArrayField
          label="الوسوم والموضوعات"
          value={draft.tags}
          onChange={(tags: string[]) => setDraft({ ...draft, tags })}
          options={tagOptions}
          maxItems={12}
          optionLabels={tagLabelsAr}
        />
        <ArrayField
          label="الطابع"
          value={draft.tone}
          onChange={(tone: string[]) => setDraft({ ...draft, tone })}
          options={tones}
          optionLabels={taxonomyLabels.tones}
          maxItems={3}
        />
        <ArrayField
          label="الدول"
          value={draft.country}
          onChange={(country: string[]) =>
            setDraft({ ...draft, country: country as Work["country"] })
          }
          options={countries}
          optionLabels={taxonomyLabels.countries}
        />
        <Field label="الجمهور">
          <Select
            value={draft.audience}
            onValueChange={(audience) =>
              audience &&
              setDraft({
                ...draft,
                audience: audience as Work["audience"],
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر الجمهور" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {audiences.map((audience) => (
                  <SelectItem key={audience} value={audience}>
                    {taxonomyLabels.audiences[audience]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <ArrayField
          label="مشاركة مع"
          value={draft.sharedWith}
          onChange={(sharedWith: string[]) =>
            setDraft({ ...draft, sharedWith })
          }
        />

        <CreditField
          value={draft.credits}
          onChange={(credits: any) => setDraft({ ...draft, credits })}
        />
      </EditorSection>

      <EditorSection
        title="سجل التقييم الشخصي"
        description="تنتج ستة مكونات موزونة التقييم المعروض في أركاديا. يبقى التقييم غير مكتمل حتى تعبئة جميع المكونات."
        className="lg:col-span-2"
      >
        <ScoreLedger draft={draft} setDraft={setDraft} />
      </EditorSection>

      {/* Guidance & Analysis Section */}
      <EditorSection
        title="إرشادات المحتوى والتحليل"
        description="تبقى إرشادات المحتوى منفصلة عن البيانات الموضوعية."
      >
        <Field label="مخاطر المحتوى الجنسي">
          <RiskSelect
            value={draft.riskProfile?.sexuality ?? "unknown"}
            onChange={(sexuality: any) =>
              setDraft({
                ...draft,
                riskProfile: {
                  sexuality,
                  behavioral: draft.riskProfile?.behavioral ?? "unknown",
                  theology: draft.riskProfile?.theology ?? "unknown",
                },
              })
            }
          />
        </Field>

        <Field label="المخاطر السلوكية">
          <RiskSelect
            value={draft.riskProfile?.behavioral ?? "unknown"}
            onChange={(behavioral: any) =>
              setDraft({
                ...draft,
                riskProfile: {
                  sexuality: draft.riskProfile?.sexuality ?? "unknown",
                  behavioral,
                  theology: draft.riskProfile?.theology ?? "unknown",
                },
              })
            }
          />
        </Field>

        <Field label="المخاطر الدينية">
          <RiskSelect
            value={draft.riskProfile?.theology ?? "unknown"}
            onChange={(theology: any) =>
              setDraft({
                ...draft,
                riskProfile: {
                  sexuality: draft.riskProfile?.sexuality ?? "unknown",
                  behavioral: draft.riskProfile?.behavioral ?? "unknown",
                  theology,
                },
              })
            }
          />
        </Field>

        <Field label="تحذيرات المحتوى" wide>
          <Textarea
            dir="rtl"
            lang="ar"
            rows={3}
            value={draft.contentWarnings ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, contentWarnings: e.target.value || null })
            }
          />
        </Field>

        <Field label="ملاحظات التحليل" wide>
          <Textarea
            dir="rtl"
            lang="ar"
            rows={4}
            value={draft.analysisNotes ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, analysisNotes: e.target.value || null })
            }
          />
        </Field>
      </EditorSection>

      {/* Dates, Source & Links Section */}
      <EditorSection
        title="التواريخ والمصدر والروابط"
        description="سياق النشر والوجهات خارج أركاديا."
      >
        <Field label="بداية الإصدار">
          <Input
            type="date"
            value={draft.releaseStart ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, releaseStart: e.target.value || null })
            }
          />
        </Field>

        <Field label="نهاية الإصدار">
          <Input
            type="date"
            value={draft.releaseEnd ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, releaseEnd: e.target.value || null })
            }
          />
        </Field>

        <Field label="نوع المصدر">
          <Input
            value={draft.sourceMaterial?.type ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                sourceMaterial: {
                  type: e.target.value,
                  started: draft.sourceMaterial?.started ?? null,
                  finished: draft.sourceMaterial?.finished ?? null,
                  serialization: draft.sourceMaterial?.serialization ?? [],
                  publication: draft.sourceMaterial?.publication ?? null,
                },
              })
            }
          />
        </Field>

        <Field label="منشور المصدر">
          <Input
            value={draft.sourceMaterial?.publication ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                sourceMaterial: {
                  type: draft.sourceMaterial?.type ?? "",
                  started: draft.sourceMaterial?.started ?? null,
                  finished: draft.sourceMaterial?.finished ?? null,
                  serialization: draft.sourceMaterial?.serialization ?? [],
                  publication: e.target.value || null,
                },
              })
            }
          />
        </Field>

        <Field label="سنة بدء المصدر">
          <Input
            type="number"
            value={draft.sourceMaterial?.started ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                sourceMaterial: {
                  type: draft.sourceMaterial?.type ?? "",
                  started: e.target.value ? Number(e.target.value) : null,
                  finished: draft.sourceMaterial?.finished ?? null,
                  serialization: draft.sourceMaterial?.serialization ?? [],
                  publication: draft.sourceMaterial?.publication ?? null,
                },
              })
            }
          />
        </Field>

        <Field label="سنة انتهاء المصدر">
          <Input
            type="number"
            value={draft.sourceMaterial?.finished ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                sourceMaterial: {
                  type: draft.sourceMaterial?.type ?? "",
                  started: draft.sourceMaterial?.started ?? null,
                  finished: e.target.value ? Number(e.target.value) : null,
                  serialization: draft.sourceMaterial?.serialization ?? [],
                  publication: draft.sourceMaterial?.publication ?? null,
                },
              })
            }
          />
        </Field>

        <ArrayField
          label="تسلسل المصدر"
          value={draft.sourceMaterial?.serialization ?? []}
          onChange={(serialization: string[]) =>
            setDraft({
              ...draft,
              sourceMaterial: {
                type: draft.sourceMaterial?.type ?? "",
                started: draft.sourceMaterial?.started ?? null,
                finished: draft.sourceMaterial?.finished ?? null,
                serialization,
                publication: draft.sourceMaterial?.publication ?? null,
              },
            })
          }
        />

        {showPublication && (
          <>
            <Field label="صيغة النشر">
              <Input
                value={draft.publication?.format ?? ""}
                onChange={(event) =>
                  updatePublication({ format: event.target.value || null })
                }
              />
            </Field>
            <Field label="الناشر">
              <Input
                value={draft.publication?.publisher ?? ""}
                onChange={(event) =>
                  updatePublication({ publisher: event.target.value || null })
                }
              />
            </Field>
            <Field label="العلامة الناشرة">
              <Input
                value={draft.publication?.imprint ?? ""}
                onChange={(event) =>
                  updatePublication({ imprint: event.target.value || null })
                }
              />
            </Field>
            {showSerialization && (
              <ArrayField
                label="التسلسل"
                value={draft.publication?.serialization ?? []}
                onChange={(serialization: string[]) =>
                  updatePublication({ serialization })
                }
              />
            )}
            <ContentField
              value={draft.publication?.contents ?? []}
              onChange={(contents) => updatePublication({ contents })}
            />
          </>
        )}

        <Field label="الروابط الخارجية" wide>
          <Textarea
            rows={4}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="AniList | AniList | https://…"
          />
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            الصيغة: المزوّد | التسمية | الرابط (رابط واحد في كل سطر)
          </p>
        </Field>
      </EditorSection>

      <EditorSection
        title="مصدر المراجعة"
        description="حالة التحقق من بيانات الفهرس الموضوعية."
      >
        <Field label="تاريخ المراجعة">
          <Input
            type="date"
            value={draft.curation?.reviewedAt ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                curation: {
                  reviewedAt: e.target.value,
                  status: draft.curation?.status ?? "provisional",
                  notes: draft.curation?.notes ?? null,
                },
              })
            }
          />
        </Field>
        <Field label="التحقق">
          <Select
            value={draft.curation?.status ?? "provisional"}
            onValueChange={(status) =>
              setDraft({
                ...draft,
                curation: {
                  reviewedAt:
                    draft.curation?.reviewedAt ??
                    new Date().toISOString().slice(0, 10),
                  status: status as "verified" | "provisional",
                  notes: draft.curation?.notes ?? null,
                },
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provisional">مبدئي</SelectItem>
              <SelectItem value="verified">موثّق</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="ملاحظات المراجعة" wide>
          <Textarea
            rows={3}
            value={draft.curation?.notes ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                curation: {
                  reviewedAt:
                    draft.curation?.reviewedAt ??
                    new Date().toISOString().slice(0, 10),
                  status: draft.curation?.status ?? "provisional",
                  notes: e.target.value || null,
                },
              })
            }
          />
        </Field>
      </EditorSection>

      {/* Local Artwork Section */}
      <EditorSection
        title="الصور المحلية"
        description="تُعرض المسارات محلياً؛ ومسح أحدها يزيل مرجعه من قاعدة البيانات."
      >
        <Field label="مسار الملصق">
          <Input
            value={draft.imagePath ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, imagePath: e.target.value || null })
            }
          />
        </Field>

        <Field label="مسار الغلاف">
          <Input
            value={draft.bannerPath ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, bannerPath: e.target.value || null })
            }
          />
        </Field>

        <Field label="مسار الشعار">
          <Input
            value={draft.logoPath ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, logoPath: e.target.value || null })
            }
          />
        </Field>
      </EditorSection>

      {/* Related Works Section */}
      <div className="lg:col-span-2">
        <EditorSection
          title="الأعمال المرتبطة"
          description="اربط الاقتباسات والتكملات وسجلات الوسائط الأخرى."
          subClassname="sm:grid-cols-1!"
        >
          <RelationshipEditor
            work={draft}
            works={works}
            onChange={(relations: any) => setDraft({ ...draft, relations })}
          />
        </EditorSection>
      </div>

      {/* Error Alert */}
      {mutation.error && (
        <div className="lg:col-span-2">
          <Alert variant="destructive">
            <InfoIcon className="size-4" />
            <AlertDescription>{mutation.error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Nested Debug Viewer wrapped in <Drawer> */}
      <div className="border-t border-border/60 pt-4 lg:col-span-2">
        <Drawer>
          <DrawerTrigger
            render={
              <Button
                type="button"
                variant="secondary"
                className="flex w-full items-center justify-between"
              >
                <span className="flex items-center gap-1.5 font-mono text-xs tracking-wider text-muted-foreground uppercase">
                  <CodeIcon className="size-3.5" />
                  عرض JSON الخام للسجل
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  للقراءة فقط
                </span>
              </Button>
            }
          />
          <DrawerContent>
            <DrawerHeader className="text-right">
              <DrawerTitle>JSON الخام للسجل</DrawerTitle>
              <DrawerDescription>
                عارض بيانات للقراءة فقط لحالة السجل الحالية.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <Textarea
                readOnly
                value={JSON.stringify(work, null, 2)}
                rows={12}
                className="resize-y border-border/50 bg-muted/40 font-mono text-[11px] leading-relaxed text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <DrawerFooter>
              <DrawerClose
                render={
                  <Button type="button" variant="outline">
                    إغلاق
                  </Button>
                }
              />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </form>
  )
}

function StructureSummary({
  structure,
}: {
  structure: WorkStructure | undefined
}) {
  if (!structure) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
        جارٍ تحميل سجل البنية…
      </div>
    )
  }

  if (structure.totalUnits === 0 && structure.seasons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
        لم تُعرّف مواسم أو وحدات مستقلة لهذا العمل بعد.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg sm:col-span-2">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-400">
          السجل المنظّم
        </span>
        <span className="text-xs text-muted-foreground">
          اكتمل {structure.completedUnits}/{structure.totalUnits}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        {structure.seasons.map((season) => {
          const completed = season.units.filter(
            (unit) => unit.progress?.status === "completed"
          ).length
          const isComplete =
            season.progress?.status === "completed" ||
            (season.units.length > 0 && completed === season.units.length)
          return (
            <span
              key={season.id}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs"
            >
              {isComplete && (
                <CheckIcon className="size-3.5 text-amber-600" weight="bold" />
              )}
              <strong className="font-medium">{season.title}</strong>
              <span className="font-mono text-[10px] text-muted-foreground">
                {completed}/{season.units.length || season.unitCount || "—"}
              </span>
            </span>
          )
        })}
        {structure.ungroupedUnits.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs">
            <strong className="font-medium capitalize">
              {structure.ungroupedUnits[0].unitType}s
            </strong>
            <span className="font-mono text-[10px] text-muted-foreground">
              {
                structure.ungroupedUnits.filter(
                  (unit) => unit.progress?.status === "completed"
                ).length
              }
              /{structure.ungroupedUnits.length}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

function ScoreLedger({
  draft,
  setDraft,
}: {
  draft: Work
  setDraft: React.Dispatch<React.SetStateAction<Work>>
}) {
  const rating = calculatedRating(draft.scoreComponents)
  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4 sm:col-span-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            التقييم المحسوب
          </span>
          <strong className="text-3xl tabular-nums">
            {rating === null ? "—" : rating.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / 10
            </span>
          </strong>
        </div>
        <Badge variant={rating === null ? "outline" : "secondary"}>
          {rating === null
            ? `${Object.keys(draft.scoreComponents).length}/6 مكونات`
            : "اكتملت المعادلة"}
        </Badge>
      </div>
      {scoreCriteria.map((criterion) => {
        const label = scoreLabel(criterion, draft.kind)
        const value = draft.scoreComponents[criterion]
        return (
          <Field
            key={criterion}
            label={`${label.ar} (${Math.round(
              scoreWeights[criterion] * 100
            )}%)`}
            wide
          >
            <div className="grid grid-cols-[1fr_4.5rem] items-center gap-3">
              <Slider
                min={0}
                max={10}
                step={0.5}
                value={[value ?? 0]}
                onValueChange={(next) => {
                  const nextValue = Array.isArray(next) ? next[0] : next
                  setDraft({
                    ...draft,
                    scoreComponents: {
                      ...draft.scoreComponents,
                      [criterion]: nextValue,
                    },
                  })
                }}
                aria-label={label.ar}
              />
              <Input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={value ?? ""}
                aria-label={`تقييم ${label.ar}`}
                onChange={(event) => {
                  const next = event.target.value
                    ? Number(event.target.value)
                    : undefined
                  const scoreComponents = { ...draft.scoreComponents }
                  if (next === undefined) delete scoreComponents[criterion]
                  else scoreComponents[criterion] = next
                  setDraft({ ...draft, scoreComponents })
                }}
              />
            </div>
          </Field>
        )
      })}
    </>
  )
}

interface EditorSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  subClassname?: string
}
export function EditorSection({
  title,
  description,
  children,
  className,
  subClassname,
}: EditorSectionProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs",
        className
      )}
    >
      <div className="flex flex-col gap-1 border-b border-border/50 pb-3">
        <h3 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-foreground uppercase">
          {title}
        </h3>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Internal Grid for child fields */}
      <div
        className={cn(
          subClassname,
          "grid grid-cols-1 items-start gap-4 sm:grid-cols-2"
        )}
      >
        {children}
      </div>
    </section>
  )
}
