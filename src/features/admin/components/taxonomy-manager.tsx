"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  BracketsCurlyIcon,
  FloppyDiskIcon,
  TextAlignLeftIcon,
  TranslateIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  getTaxonomyTerms,
  saveTaxonomyTranslations,
  saveTaxonomyTranslation,
} from "@/server/library.functions"

const taxonomyJsonSchema = z.array(
  z.object({
    id: z.string().min(1),
    labelAr: z.string().nullable(),
    description: z.string(),
    descriptionAr: z.string(),
  })
)

export function TaxonomyManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [jsonView, setJsonView] = useState(false)
  const [json, setJson] = useState("")
  const [jsonDirty, setJsonDirty] = useState(false)
  const [jsonError, setJsonError] = useState("")
  const query = useQuery({
    queryKey: ["taxonomy-terms"],
    queryFn: () => getTaxonomyTerms(),
    enabled: open,
  })
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return (query.data ?? []).filter(
      (term) =>
        !needle ||
        [term.labelEn, term.labelAr, term.key, term.vocabulary].some((value) =>
          value?.toLocaleLowerCase().includes(needle)
        )
    )
  }, [query.data, search])
  const selected =
    query.data?.find((term) => term.id === selectedId) ?? filtered[0] ?? null
  const jsonSource = useMemo(
    () =>
      (query.data ?? []).map(({ id, labelAr, description, descriptionAr }) => ({
        id,
        labelAr,
        description,
        descriptionAr,
      })),
    [query.data]
  )
  const parsedJson = useMemo(() => {
    try {
      const parsed = taxonomyJsonSchema.parse(JSON.parse(json))
      const expectedIds = jsonSource.map(({ id }) => id).sort()
      const receivedIds = parsed.map(({ id }) => id)
      if (
        new Set(receivedIds).size !== receivedIds.length ||
        JSON.stringify(expectedIds) !== JSON.stringify([...receivedIds].sort())
      ) {
        throw new Error(
          "احتفظ بجميع معرّفات المصطلحات مرة واحدة دون إضافة أو حذف."
        )
      }
      return { data: parsed, error: "" }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "JSON غير صالح.",
      }
    }
  }, [json, jsonSource])
  const jsonMutation = useMutation({
    mutationFn: saveTaxonomyTranslations,
    onSuccess: async () => {
      await query.refetch()
      setJsonDirty(false)
      setJsonError("")
    },
  })

  useEffect(() => {
    if (!open || !query.data || jsonDirty) return
    setJson(JSON.stringify(jsonSource, null, 2))
  }, [jsonDirty, jsonSource, open, query.data])

  const saveJson = () => {
    if (!parsedJson.data) {
      setJsonError(parsedJson.error)
      return
    }
    setJsonError("")
    jsonMutation.mutate({ data: { translations: parsedJson.data } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b p-5 text-right">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2">
                {jsonView ? (
                  <BracketsCurlyIcon data-icon="inline-start" />
                ) : (
                  <TranslateIcon data-icon="inline-start" />
                )}
                قاموس التصنيفات المنقّح
              </DialogTitle>
              <DialogDescription>
                مفاتيح إنجليزية ثابتة وتسميات عربية أولاً مع سياق الاستخدام.
              </DialogDescription>
            </div>
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="taxonomy-json-view"
                checked={jsonView}
                onCheckedChange={setJsonView}
              />
              <FieldLabel htmlFor="taxonomy-json-view">تحرير JSON</FieldLabel>
            </Field>
          </div>
        </DialogHeader>
        {jsonView ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <Badge variant={parsedJson.data ? "secondary" : "destructive"}>
                {parsedJson.data ? "JSON صالح" : "يحتاج تصحيحاً"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {jsonSource.length} مصطلح · {json.length.toLocaleString()} حرف
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ms-auto"
                onClick={() => {
                  try {
                    setJson(JSON.stringify(JSON.parse(json), null, 2))
                    setJsonError("")
                  } catch (error) {
                    setJsonError(
                      error instanceof Error ? error.message : "JSON غير صالح."
                    )
                  }
                }}
              >
                <TextAlignLeftIcon data-icon="inline-start" />
                تنسيق
              </Button>
            </div>
            <Textarea
              value={json}
              onChange={(event) => {
                setJson(event.target.value)
                setJsonDirty(true)
                setJsonError("")
              }}
              className="min-h-0 flex-1 resize-none rounded-none border-0 p-5 text-left font-mono text-xs leading-6 [unicode-bidi:plaintext] focus-visible:ring-0"
              dir="ltr"
              spellCheck={false}
              aria-label="قاموس التصنيفات بصيغة JSON"
              aria-invalid={!parsedJson.data}
            />
            {(jsonError || jsonMutation.error) && (
              <Alert variant="destructive" className="rounded-none border-x-0">
                <WarningCircleIcon />
                <AlertTitle>تعذر حفظ JSON</AlertTitle>
                <AlertDescription>
                  {jsonError || jsonMutation.error?.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[20rem_1fr]">
            <div className="flex min-h-0 flex-col border-e">
              <div className="border-b p-3">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث بالعربية أو الإنجليزية أو المفتاح…"
                  aria-label="البحث في قاموس التصنيفات"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {filtered.map((term) => (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() => setSelectedId(term.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-right hover:bg-muted"
                    data-active={selected?.id === term.id}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">
                        {term.labelAr || term.labelEn}
                      </strong>
                      <span className="block truncate text-xs text-muted-foreground">
                        {term.labelEn} · {term.key}
                      </span>
                    </span>
                    <Badge variant="outline">{term.usageCount}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto p-5">
              {selected ? (
                <TaxonomyTranslationForm
                  key={selected.id}
                  term={selected}
                  onSaved={async () => {
                    await query.refetch()
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  لا يوجد مصطلح يطابق هذا البحث.
                </p>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          {jsonView && (
            <Button
              onClick={saveJson}
              disabled={
                !jsonDirty || !parsedJson.data || jsonMutation.isPending
              }
            >
              <FloppyDiskIcon data-icon="inline-start" />
              {jsonMutation.isPending ? "جارٍ الحفظ…" : "حفظ JSON"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaxonomyTranslationForm({
  term,
  onSaved,
}: {
  term: Awaited<ReturnType<typeof getTaxonomyTerms>>[number]
  onSaved: () => Promise<void>
}) {
  const [labelAr, setLabelAr] = useState(term.labelAr ?? "")
  const [description, setDescription] = useState(term.description)
  const [descriptionAr, setDescriptionAr] = useState(term.descriptionAr)
  const mutation = useMutation({
    mutationFn: () =>
      saveTaxonomyTranslation({
        data: {
          id: term.id,
          labelAr: labelAr || null,
          description,
          descriptionAr,
        },
      }),
    onSuccess: onSaved,
  })

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{term.vocabulary}</Badge>
        <Badge variant="outline">{term.usageCount} عمل</Badge>
        <code className="text-xs text-muted-foreground">{term.key}</code>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="taxonomy-label-en">
            التسمية الإنجليزية
          </FieldLabel>
          <Input id="taxonomy-label-en" value={term.labelEn} disabled />
          <FieldDescription>
            لا يتغير المفتاح الثابت والتسمية الإنجليزية إلا عبر ترحيل دمج
            مُراجع.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="taxonomy-label-ar">التسمية العربية</FieldLabel>
          <Input
            id="taxonomy-label-ar"
            dir="rtl"
            lang="ar"
            value={labelAr}
            onChange={(event) => setLabelAr(event.target.value)}
            placeholder="التسمية العربية"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="taxonomy-description-en">
            التعريف الإنجليزي
          </FieldLabel>
          <Textarea
            id="taxonomy-description-en"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="taxonomy-description-ar">
            التعريف العربي
          </FieldLabel>
          <Textarea
            id="taxonomy-description-ar"
            dir="rtl"
            lang="ar"
            value={descriptionAr}
            onChange={(event) => setDescriptionAr(event.target.value)}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "جارٍ الحفظ…" : "حفظ الترجمة"}
      </Button>
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
    </form>
  )
}
