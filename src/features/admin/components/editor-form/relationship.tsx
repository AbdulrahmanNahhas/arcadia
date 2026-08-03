import { ArrowRightIcon, LinkIcon, TrashIcon } from "@phosphor-icons/react";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Work, WorkRelation } from "@/features/library/model";

export type RelationType =
  | "adaptation"
  | "sequel"
  | "spin-off"
  | "side-story"
  | "compilation"
  | "alternative"
  | "related";

export type RelationDirection = "outgoing" | "incoming";

const RELATION_TYPES: { value: RelationType; label: string }[] = [
  { value: "adaptation", label: "اقتباس" },
  { value: "sequel", label: "تكملة" },
  { value: "spin-off", label: "عمل مشتق" },
  { value: "side-story", label: "قصة جانبية" },
  { value: "compilation", label: "تجميع" },
  { value: "alternative", label: "نسخة بديلة" },
  { value: "related", label: "مرتبط" },
];

interface RelationshipEditorProps {
  work: Work;
  works: Work[];
  onChange: (relations: WorkRelation[]) => void;
}

export function RelationshipEditor({ work, works, onChange }: RelationshipEditorProps) {
  const relations = work.relations;
  const candidates = works.filter((candidate) => candidate.id !== work.id);

  const nextAvailable = () => {
    for (const candidate of candidates) {
      for (const type of RELATION_TYPES) {
        if (
          !relations.some(
            (relation) => relation.workId === candidate.id && relation.relationType === type.value,
          )
        ) {
          return { candidate, relationType: type.value };
        }
      }
    }
    return null;
  };

  const addRelation = () => {
    const available = nextAvailable();
    if (!available) return;
    const { candidate, relationType } = available;

    const newRelation: WorkRelation = {
      id: crypto.randomUUID(),
      workId: candidate.id,
      relationType,
      direction: "outgoing",
      notes: "",
      provenance: "manual",
      externalKey: null,
      work: {
        id: candidate.id,
        title: candidate.title,
        kind: candidate.kind,
        year: candidate.year,
        releaseStatus: candidate.releaseStatus,
        imagePath: candidate.imagePath,
      },
    };

    onChange([...relations, newRelation]);
  };

  const update = (index: number, patch: Partial<WorkRelation>) => {
    const updated = relations.map((relation, current) => {
      if (current !== index) return relation;

      const candidate = patch.workId ? works.find((item) => item.id === patch.workId) : undefined;

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
      };
    });

    onChange(updated);
  };

  const remove = (index: number) => {
    onChange(relations.filter((_, current) => current !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {relations.length === 0 ? (
        <Empty className="border bg-muted/20 p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>لا توجد علاقات مرتبطة بعد</EmptyTitle>
            <EmptyDescription>
              اربط هذا السجل بأعمال سابقة أو تكملات أو اقتباسات أو أعمال مشتقة.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRelation}
              disabled={!nextAvailable()}
            >
              <PlusIcon data-icon="inline-start" />
              إضافة علاقة
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {relations.map((relation, index) => (
              <div
                key={relation.id || index}
                className="flex flex-col items-stretch gap-2 rounded-md border border-border/60 bg-muted/30 p-2.5 transition-colors hover:border-border lg:flex-row lg:items-center"
              >
                {/* Target Work Dropdown */}
                <div className="flex min-w-[200px]">
                  <Select
                    items={candidates.map((candidate) => ({
                      value: candidate.id,
                      label: candidate.arabicTitle || candidate.title,
                    }))}
                    value={relation.workId}
                    onValueChange={(val) => update(index, { workId: val ?? undefined })}
                  >
                    <SelectTrigger className="h-8 bg-background text-xs">
                      <SelectValue placeholder="اختر العمل الهدف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {candidates.map((candidate) => (
                          <SelectItem
                            key={candidate.id}
                            value={candidate.id}
                            disabled={relations.some(
                              (item, current) =>
                                current !== index &&
                                item.workId === candidate.id &&
                                item.relationType === relation.relationType,
                            )}
                            className="text-xs"
                          >
                            <span className="font-medium">
                              {candidate.arabicTitle || candidate.title}
                            </span>
                            {candidate.year && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">
                                ({candidate.year})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Relation Type Dropdown */}
                <div className="w-full shrink-0 lg:w-36">
                  <Select
                    items={RELATION_TYPES}
                    value={relation.relationType}
                    onValueChange={(val) => update(index, { relationType: val as RelationType })}
                  >
                    <SelectTrigger className="h-8 bg-background text-xs capitalize">
                      <SelectValue placeholder="النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {RELATION_TYPES.map((type) => (
                          <SelectItem
                            key={type.value}
                            value={type.value}
                            disabled={relations.some(
                              (item, current) =>
                                current !== index &&
                                item.workId === relation.workId &&
                                item.relationType === type.value,
                            )}
                            className="text-xs capitalize"
                          >
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Direction Selector */}
                <div className="w-full shrink-0 lg:w-44">
                  <Select
                    items={[
                      { value: "outgoing", label: "هذا العمل ← الهدف" },
                      { value: "incoming", label: "الهدف ← هذا العمل" },
                    ]}
                    value={relation.direction}
                    onValueChange={(val) => update(index, { direction: val as RelationDirection })}
                  >
                    <SelectTrigger className="h-8 bg-background text-xs">
                      <SelectValue placeholder="الاتجاه" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="outgoing" className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <span>هذا العمل</span>
                            <ArrowRightIcon className="size-3 text-muted-foreground" />
                            <span>الهدف</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="incoming" className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <span>الهدف</span>
                            <ArrowRightIcon className="size-3 text-muted-foreground" />
                            <span>هذا العمل</span>
                          </div>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes Input */}
                <div className="min-w-[140px] flex-1">
                  <Input
                    value={relation.notes}
                    placeholder="ملاحظة، مثلاً الموسم الأول"
                    onChange={(e) => update(index, { notes: e.target.value })}
                    className="h-8 bg-background text-xs"
                  />
                </div>

                <div className="min-w-[120px] flex-1">
                  <Input
                    value={relation.provenance}
                    placeholder="مصدر العلاقة"
                    onChange={(event) => update(index, { provenance: event.target.value })}
                    className="h-8 bg-background text-xs"
                  />
                </div>

                <div className="min-w-[120px] flex-1">
                  <Input
                    value={relation.externalKey ?? ""}
                    placeholder="المعرّف الخارجي"
                    onChange={(event) => update(index, { externalKey: event.target.value || null })}
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
                  <TrashIcon />
                  <span className="sr-only">إزالة العلاقة</span>
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRelation}
            disabled={!nextAvailable()}
            className="flex h-8 w-full items-center justify-center gap-1.5 border-dashed text-xs"
          >
            <PlusIcon data-icon="inline-start" />
            إضافة علاقة
          </Button>
        </>
      )}
    </div>
  );
}
