"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { useMutation } from "@tanstack/react-query"
import {  InfoIcon, CodeIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
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

import { kindLabels, personalStatuses } from "@/features/library/filtering"
import {
  workKinds,
  type AdminWorkUpdate,
  type Work,
  type WorkKind,
} from "@/features/library/model"
import { saveWork } from "@/server/library.functions"

import { RelationshipEditor } from "./relationship"
import { Field } from "./fields/field"
import { ArrayField } from "./fields/array-field"
import { CreditField } from "./fields/credit-field"
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

  const title = `Edit ${work.title ?? "Work"}`
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
      submit={submit}
    />
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-background text-foreground rounded-xl! overflow-hidden">
          <DialogHeader className="p-4 border-b border-border shadow-sm z-10 shrink-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>

          {formFields}

          <DialogFooter className="p-4 border-t border-border/60 bg-background shrink-0 flex flex-row items-center justify-end gap-2">
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
      <DrawerContent className="h-[90vh] flex flex-col p-0 gap-0 bg-background text-foreground">
        <DrawerHeader className="p-6 border-b border-border/60 shrink-0 text-left">
          <DrawerTitle className="text-xl font-bold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground">
            {description}
          </DrawerDescription>
        </DrawerHeader>

        {formFields}

        <DrawerFooter className="p-4 border-t border-border/60 bg-background shrink-0 flex flex-row items-center justify-end gap-2">
          <DrawerClose render={<Button type="button" variant="outline" size="sm">Cancel</Button>} />
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
  submit,
}: {
  work: Work
  works: Work[]
  draft: Work
  setDraft: React.Dispatch<React.SetStateAction<Work>>
  links: string
  setLinks: React.Dispatch<React.SetStateAction<string>>
  mutation: any
  submit: (e: FormEvent) => void
}) {
  return (
    <form
      id="admin-editor-form"
      className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
      onSubmit={submit}
    >
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
            value={draft.subtitle ?? ""}
            onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          />
        </Field>

        <Field label="Type">
          <Select
            value={draft.kind}
            onValueChange={(value) =>
              setDraft({ ...draft, kind: value as WorkKind })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {workKinds.map((kind: string) => (
                <SelectItem key={kind} value={kind}>
                  {kindLabels[kind] ?? kind}
                </SelectItem>
              ))}
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
              {["announced", "releasing", "released", "ended", "unknown"].map(
                (status) => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Creator">
          <Input
            value={draft.creator ?? ""}
            onChange={(e) => setDraft({ ...draft, creator: e.target.value })}
          />
        </Field>

        <ArrayField
          label="Aliases"
          value={draft.aliases}
          onChange={(aliases: string[]) => setDraft({ ...draft, aliases })}
        />

        <Field label="Summary" wide>
          <Textarea
            rows={5}
            value={draft.summary ?? ""}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            className="resize-y"
          />
        </Field>
      </EditorSection>

      {/* Personal State Section */}
      <EditorSection
        title="Personal state"
        description="Your private relationship with this work."
      >
        <Field label="Status">
          <Select
            value={draft.status}
            onValueChange={(value) =>
              setDraft({ ...draft, status: value as Work["status"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select personal status" />
            </SelectTrigger>
            <SelectContent>
              {personalStatuses.map((status: string) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status.replace("-", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Rating">
          <Input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={draft.rating ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                rating: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>

        {draft.kind !== "manga" && draft.kind !== "novel" && (
          <>
            <Field label="Progress">
              <Input
                type="number"
                min="0"
                value={draft.progress ?? 0}
                onChange={(e) =>
                  setDraft({ ...draft, progress: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Progress total">
              <Input
                type="number"
                min="0"
                value={draft.progressTotal ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    progressTotal: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </Field>
            <Field label="Progress unit">
              <Input
                value={draft.progressUnit ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, progressUnit: e.target.value })
                }
              />
            </Field>
          </>
        )}

        <Field label="Personal notes" wide>
          <Textarea
            rows={4}
            value={draft.notes ?? ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="resize-y"
          />
        </Field>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="favorite-toggle"
            checked={draft.favorite ?? false}
            onCheckedChange={(favorite) =>
              setDraft({ ...draft, favorite: Boolean(favorite) })
            }
          />
          <Label htmlFor="favorite-toggle" className="text-sm font-medium cursor-pointer">
            Favorite
          </Label>
        </div>
      </EditorSection>

      {/* Classification Section */}
      <EditorSection
        title="Classification"
        description="Comma-separated values become searchable facets."
      >
        <ArrayField
          label="Genres"
          value={draft.genres}
          onChange={(genres: string[]) => setDraft({ ...draft, genres })}
        />
        <ArrayField
          label="Tags & themes"
          value={draft.tags}
          onChange={(tags: string[]) => setDraft({ ...draft, tags })}
        />
        <ArrayField
          label="Studios"
          value={draft.studios}
          onChange={(studios: string[]) => setDraft({ ...draft, studios })}
        />
        <ArrayField
          label="Tone"
          value={draft.tone}
          onChange={(tone: string[]) => setDraft({ ...draft, tone })}
        />
        <ArrayField
          label="Countries"
          value={draft.country}
          onChange={(country: string[]) => setDraft({ ...draft, country })}
        />
        <ArrayField
          label="Audience"
          value={draft.audience}
          onChange={(audience: string[]) => setDraft({ ...draft, audience })}
        />
        <ArrayField
          label="Shared with"
          value={draft.sharedWith}
          onChange={(sharedWith: string[]) =>
            setDraft({ ...draft, sharedWith })
          }
        />
        <ArrayField
          label="Favorite characters"
          value={draft.favoriteCharacters}
          onChange={(favoriteCharacters: string[]) =>
            setDraft({ ...draft, favoriteCharacters })
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

        <Field label="Publication format">
          <Input
            value={draft.publication?.format ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                publication: {
                  format: e.target.value || null,
                  publisher: draft.publication?.publisher ?? null,
                  imprint: draft.publication?.imprint ?? null,
                  serialization: draft.publication?.serialization ?? [],
                  demographic: draft.publication?.demographic ?? null,
                  contents: draft.publication?.contents ?? [],
                },
              })
            }
          />
        </Field>

        <Field label="Publisher / imprint">
          <Input
            value={draft.publication?.publisher ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                publication: {
                  format: draft.publication?.format ?? null,
                  publisher: e.target.value || null,
                  imprint: draft.publication?.imprint ?? null,
                  serialization: draft.publication?.serialization ?? [],
                  demographic: draft.publication?.demographic ?? null,
                  contents: draft.publication?.contents ?? [],
                },
              })
            }
          />
        </Field>

        <Field label="External links" wide>
          <Textarea
            rows={4}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="AniList | AniList | https://…"
          />
          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
            Format: provider | label | URL (one per line)
          </p>
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
      <div className="lg:col-span-2 pt-4 border-t border-border/60">
        <Drawer>
          <DrawerTrigger
            render={
              <Button
                type="button"
                variant="secondary"
                className="w-full flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <CodeIcon className="size-3.5" />
                  View Raw Record JSON
                </span>
                <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
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
            <div className="flex-1 p-4 overflow-y-auto">
              <Textarea
                readOnly
                value={JSON.stringify(work, null, 2)}
                rows={12}
                className="font-mono text-[11px] leading-relaxed bg-muted/40 text-muted-foreground border-border/50 focus-visible:ring-0 resize-y"
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
  subClassname
}: EditorSectionProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-5 shadow-xs space-y-4",
        className
      )}
    >
      <div className="space-y-1 border-b border-border/50 pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Internal Grid for child fields */}
      <div className={cn(subClassname, "grid grid-cols-1 sm:grid-cols-2 gap-4 items-start")}>
        {children}
      </div>
    </section>
  )
}
