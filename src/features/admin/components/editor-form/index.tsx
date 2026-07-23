"use client"

import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { InfoIcon, CodeIcon, CheckIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { audiences, genres, tones, workKinds } from "@/features/library/model"
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

  const title = `Edit ${work.title}`
  const description =
    "Objective metadata, personal state, guidance, links, and local assets."

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
        <DialogContent className="flex h-[92vh] flex-col gap-0 overflow-hidden rounded-xl! bg-background p-0 text-foreground sm:max-w-6xl">
          <DialogHeader className="z-10 shrink-0 border-b border-l-4 border-border border-l-amber-500 p-4 text-left shadow-sm">
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
              Cancel
            </Button>
            <Button
              type="submit"
              form="admin-editor-form"
              size="sm"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[90vh] flex-col gap-0 bg-background p-0 text-foreground">
        <DrawerHeader className="shrink-0 border-b border-border/60 p-6 text-left">
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
                Cancel
              </Button>
            }
          />
          <Button
            type="submit"
            form="admin-editor-form"
            size="sm"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
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
  const showRuntime = ["movie", "game", "visual-novel"].includes(draft.kind)
  const showPages = ["manga", "comic", "novel"].includes(draft.kind)
  const showEpisodes = ["series", "anime"].includes(draft.kind)
  const showChapters = ["manga", "comic"].includes(draft.kind)
  const showPublication = ["manga", "comic", "novel"].includes(draft.kind)
  const showSerialization = ["manga", "comic"].includes(draft.kind)

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

  const changeKind = (kind: WorkKind) => {
    setDraft({
      ...draft,
      kind,
      runtimeMinutes: ["movie", "game", "visual-novel"].includes(kind)
        ? draft.runtimeMinutes
        : null,
      pageCount: ["manga", "comic", "novel"].includes(kind)
        ? draft.pageCount
        : null,
      episodeCount: ["series", "anime"].includes(kind)
        ? draft.episodeCount
        : null,
      chapterCount: ["manga", "comic"].includes(kind)
        ? draft.chapterCount
        : null,
      publication: ["manga", "comic", "novel"].includes(kind)
        ? {
            ...(draft.publication ?? {
              format: null,
              publisher: null,
              imprint: null,
              serialization: [],
              contents: [],
            }),
            serialization: ["manga", "comic"].includes(kind)
              ? (draft.publication?.serialization ?? [])
              : [],
          }
        : null,
    })
  }

  return (
    <form
      id="admin-editor-form"
      className="grid flex-1 grid-cols-1 items-start gap-6 overflow-y-auto p-6 lg:grid-cols-2"
      onSubmit={submit}
    >
      <div className="lg:col-span-2">
        <EditorSection
          title="Structure & tracking"
          description="Canonical work metrics and the normalized season/unit ledger. Progress is stored against these stable units."
        >
          {showRuntime && (
            <Field label="Runtime (minutes)">
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
          {showPages && (
            <Field label="Page count">
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
            <Field label="Episode count">
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
            <Field label="Chapter count">
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
          <StructureSummary structure={structure} />
        </EditorSection>
      </div>

      {/* Identity Section */}
      <EditorSection
        title="Identity"
        description="Core fields used everywhere in Arcadia."
      >
        <Field label="Title">
          <Input
            value={draft.title}
            required
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>

        <Field label="Subtitle">
          <Input
            value={draft.subtitle}
            onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          />
        </Field>

        <Field label="Type">
          <Select
            value={draft.kind}
            onValueChange={(value) => changeKind(value as WorkKind)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
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

        <Field label="Release year">
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

        <Field label="Release status">
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
              <SelectValue placeholder="Select status" />
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
                      {status}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <ArrayField
          label="Aliases"
          value={draft.aliases}
          onChange={(aliases: string[]) => setDraft({ ...draft, aliases })}
        />

        <Field label="Summary" wide>
          <Textarea
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
        title="Classification"
        description="Comma-separated values become searchable facets."
      >
        <ArrayField
          label="Genres"
          value={draft.genres}
          onChange={(nextGenres: string[]) =>
            setDraft({ ...draft, genres: nextGenres })
          }
          options={genres}
        />
        <ArrayField
          label="Tags & themes"
          value={draft.tags}
          onChange={(tags: string[]) => setDraft({ ...draft, tags })}
        />
        <ArrayField
          label="Tone"
          value={draft.tone}
          onChange={(tone: string[]) => setDraft({ ...draft, tone })}
          options={tones}
        />
        <ArrayField
          label="Countries"
          value={draft.country}
          onChange={(country: string[]) => setDraft({ ...draft, country })}
        />
        <Field label="Audience">
          <Select
            value={draft.audience[0] ?? null}
            onValueChange={(audience) =>
              audience && setDraft({ ...draft, audience: [audience] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {audiences.map((audience) => (
                  <SelectItem key={audience} value={audience}>
                    {audience}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <ArrayField
          label="Shared with"
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

      {/* Guidance & Analysis Section */}
      <EditorSection
        title="Guidance & analysis"
        description="Content guidance stays distinct from objective metadata."
      >
        <Field label="Sexuality risk">
          <RiskSelect
            value={draft.riskProfile?.sexuality ?? "unknown"}
            onChange={(sexuality: any) =>
              setDraft({
                ...draft,
                riskProfile: {
                  sexuality,
                  fanService: draft.riskProfile?.fanService ?? null,
                  behavioral: draft.riskProfile?.behavioral ?? "unknown",
                  theology: draft.riskProfile?.theology ?? "unknown",
                },
              })
            }
          />
        </Field>

        <Field label="Behavioral risk">
          <RiskSelect
            value={draft.riskProfile?.behavioral ?? "unknown"}
            onChange={(behavioral: any) =>
              setDraft({
                ...draft,
                riskProfile: {
                  sexuality: draft.riskProfile?.sexuality ?? "unknown",
                  fanService: draft.riskProfile?.fanService ?? null,
                  behavioral,
                  theology: draft.riskProfile?.theology ?? "unknown",
                },
              })
            }
          />
        </Field>

        <Field label="Theology risk">
          <RiskSelect
            value={draft.riskProfile?.theology ?? "unknown"}
            onChange={(theology: any) =>
              setDraft({
                ...draft,
                riskProfile: {
                  sexuality: draft.riskProfile?.sexuality ?? "unknown",
                  fanService: draft.riskProfile?.fanService ?? null,
                  behavioral: draft.riskProfile?.behavioral ?? "unknown",
                  theology,
                },
              })
            }
          />
        </Field>

        <Field label="Fan-service level">
          <Input
            type="number"
            min="0"
            max="10"
            value={draft.riskProfile?.fanService ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                riskProfile: {
                  sexuality: draft.riskProfile?.sexuality ?? "unknown",
                  fanService: e.target.value ? Number(e.target.value) : null,
                  behavioral: draft.riskProfile?.behavioral ?? "unknown",
                  theology: draft.riskProfile?.theology ?? "unknown",
                },
              })
            }
          />
        </Field>

        <Field label="Content warnings" wide>
          <Textarea
            rows={3}
            value={draft.contentWarnings ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, contentWarnings: e.target.value || null })
            }
          />
        </Field>

        <Field label="Analysis notes" wide>
          <Textarea
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
        title="Dates, source & links"
        description="Publishing context and destinations outside Arcadia."
      >
        <Field label="Release start">
          <Input
            type="date"
            value={draft.releaseStart ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, releaseStart: e.target.value || null })
            }
          />
        </Field>

        <Field label="Release end">
          <Input
            type="date"
            value={draft.releaseEnd ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, releaseEnd: e.target.value || null })
            }
          />
        </Field>

        <Field label="Source type">
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

        <Field label="Source publication">
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

        <Field label="Source started">
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

        <Field label="Source finished">
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
          label="Source serialization"
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
            <Field label="Publication format">
              <Input
                value={draft.publication?.format ?? ""}
                onChange={(event) =>
                  updatePublication({ format: event.target.value || null })
                }
              />
            </Field>
            <Field label="Publisher">
              <Input
                value={draft.publication?.publisher ?? ""}
                onChange={(event) =>
                  updatePublication({ publisher: event.target.value || null })
                }
              />
            </Field>
            <Field label="Imprint">
              <Input
                value={draft.publication?.imprint ?? ""}
                onChange={(event) =>
                  updatePublication({ imprint: event.target.value || null })
                }
              />
            </Field>
            {showSerialization && (
              <ArrayField
                label="Serialization"
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

        <Field label="External links" wide>
          <Textarea
            rows={4}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="AniList | AniList | https://…"
          />
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            Format: provider | label | URL (one per line)
          </p>
        </Field>
      </EditorSection>

      <EditorSection
        title="Curation provenance"
        description="Verification state for objective catalog data."
      >
        <Field label="Reviewed at">
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
        <Field label="Verification">
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
              <SelectItem value="provisional">Provisional</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Curation notes" wide>
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
        title="Local artwork"
        description="Paths are served locally; clearing one removes its database asset reference."
      >
        <Field label="Poster path">
          <Input
            value={draft.imagePath ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, imagePath: e.target.value || null })
            }
          />
        </Field>

        <Field label="Banner path">
          <Input
            value={draft.bannerPath ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, bannerPath: e.target.value || null })
            }
          />
        </Field>

        <Field label="Logo path">
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
          title="Related works"
          description="Link adaptations, sequels, and other media records."
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
                  View Raw Record JSON
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Read-only
                </span>
              </Button>
            }
          />
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Raw Record JSON</DrawerTitle>
              <DrawerDescription>
                Read-only data viewer for the current record state.
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
                    Close
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
        Loading structural ledger…
      </div>
    )
  }

  if (structure.totalUnits === 0 && structure.seasons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
        No seasons or atomic units are defined for this work yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-amber-500/25 bg-amber-500/4 sm:col-span-2">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-400">
          Normalized ledger
        </span>
        <span className="text-xs text-muted-foreground">
          {structure.completedUnits}/{structure.totalUnits} complete
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
        "space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs",
        className
      )}
    >
      <div className="space-y-1 border-b border-border/50 pb-3">
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
