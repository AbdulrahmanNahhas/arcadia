import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { Work, WorkRelation } from "@/features/library/model"
import { ArrowRightIcon, LinkIcon, TrashIcon } from "@phosphor-icons/react"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr"

export type RelationType =
  "adaptation" | "sequel" | "prequel" | "spin-off" | "related"

export type RelationDirection = "outgoing" | "incoming"

const RELATION_TYPES: { value: RelationType; label: string }[] = [
  { value: "adaptation", label: "Adaptation" },
  { value: "sequel", label: "Sequel" },
  { value: "prequel", label: "Prequel" },
  { value: "spin-off", label: "Spin-off" },
  { value: "related", label: "Related" },
]

interface RelationshipEditorProps {
  work: Work
  works: Work[]
  onChange: (relations: WorkRelation[]) => void
}

export function RelationshipEditor({
  work,
  works,
  onChange,
}: RelationshipEditorProps) {
  const relations = work.relations
  const candidates = works.filter((candidate) => candidate.id !== work.id)

  const addRelation = () => {
    const candidate = candidates.at(0)
    if (!candidate) return

    const newRelation: WorkRelation = {
      id: crypto.randomUUID(),
      workId: candidate.id,
      relationType: "related",
      direction: "outgoing",
      notes: "",
      work: {
        id: candidate.id,
        title: candidate.title,
        kind: candidate.kind,
        year: candidate.year,
        releaseStatus: candidate.releaseStatus,
        imagePath: candidate.imagePath,
      },
    }

    onChange([...relations, newRelation])
  }

  const update = (index: number, patch: Partial<WorkRelation>) => {
    const updated = relations.map((relation, current) => {
      if (current !== index) return relation

      const candidate = patch.workId
        ? works.find((item) => item.id === patch.workId)
        : undefined

      return {
        ...relation,
        ...patch,
        ...(candidate
          ? {
              work: {
                id: candidate.id,
                title: candidate.title,
                kind: candidate.kind,
                year: candidate.year,
                releaseStatus: candidate.releaseStatus,
                imagePath: candidate.imagePath,
              },
            }
          : {}),
      }
    })

    onChange(updated)
  }

  const remove = (index: number) => {
    onChange(relations.filter((_, current) => current !== index))
  }

  return (
    <div className="space-y-3">
      {relations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <LinkIcon className="mb-2 size-8 text-muted-foreground/40" />
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            No relationships linked yet
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground/70">
            Connect this entry to prequels, sequels, adaptations, or spin-offs.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRelation}
            disabled={candidates.length === 0}
            className="h-8 text-xs"
          >
            <PlusIcon className="mr-1 size-3.5" />
            Add Relationship
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {relations.map((relation, index) => (
              <div
                key={relation.id || index}
                className="flex flex-col items-stretch gap-2 rounded-md border border-border/60 bg-muted/30 p-2.5 transition-colors hover:border-border lg:flex-row lg:items-center"
              >
                {/* Target Work Dropdown */}
                <div className="flex min-w-[200px]">
                  <Select
                    value={relation.workId}
                    onValueChange={(val) =>
                      update(index, { workId: val ?? undefined })
                    }
                  >
                    <SelectTrigger className="h-8 bg-background text-xs">
                      <SelectValue placeholder="Select target work" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((candidate) => (
                        <SelectItem
                          key={candidate.id}
                          value={candidate.id}
                          className="text-xs"
                        >
                          <span className="font-medium">{candidate.title}</span>
                          {candidate.year && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                              ({candidate.year})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Relation Type Dropdown */}
                <div className="w-full shrink-0 lg:w-36">
                  <Select
                    value={relation.relationType}
                    onValueChange={(val) =>
                      update(index, { relationType: val as RelationType })
                    }
                  >
                    <SelectTrigger className="h-8 bg-background text-xs capitalize">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_TYPES.map((type) => (
                        <SelectItem
                          key={type.value}
                          value={type.value}
                          className="text-xs capitalize"
                        >
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Direction Selector */}
                <div className="w-full shrink-0 lg:w-44">
                  <Select
                    value={relation.direction}
                    onValueChange={(val) =>
                      update(index, { direction: val as RelationDirection })
                    }
                  >
                    <SelectTrigger className="h-8 bg-background text-xs">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outgoing" className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>This</span>
                          <ArrowRightIcon className="size-3 text-muted-foreground" />
                          <span>Target</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="incoming" className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>Target</span>
                          <ArrowRightIcon className="size-3 text-muted-foreground" />
                          <span>This</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes Input */}
                <div className="min-w-[140px] flex-1">
                  <Input
                    value={relation.notes}
                    placeholder="Note (e.g. S1, TV Ver.)"
                    onChange={(e) => update(index, { notes: e.target.value })}
                    className="h-8 bg-background text-xs"
                  />
                </div>

                {/* Remove Action */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="size-8 shrink-0 self-end text-muted-foreground hover:text-destructive lg:self-auto"
                >
                  <TrashIcon className="size-4" />
                  <span className="sr-only">Remove relationship</span>
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRelation}
            disabled={candidates.length === 0}
            className="flex h-8 w-full items-center justify-center gap-1.5 border-dashed text-xs"
          >
            <PlusIcon className="size-3.5" />
            Add Relationship
          </Button>
        </>
      )}
    </div>
  )
}
