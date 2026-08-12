"use client";

import {
  CheckIcon,
  CodeIcon,
  ImageSquareIcon,
  InfoIcon,
  LockKeyIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { kindLabels } from "@/features/library/filtering";
import type {
  AdminWorkUpdate,
  EditableWorkStructure,
  Entity,
  Work,
  WorkKind,
  WorkStructure,
} from "@/features/library/model";
import {
  audiences,
  countries,
  editableWorkStructureSchema,
  genres,
  tagLabelsAr,
  taxonomyLabels,
  tones,
  workKinds,
} from "@/features/library/model";

import { useArabicTranslations } from "@/features/library/translations";

import type { PlanetWithWorks } from "@/features/platform/model";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  getAdminWorkStructure,
  getWorkStructure,
  saveWork,
  saveWorkStructure,
  uploadWorkImage,
} from "@/server/library.functions";
import { getAdminPlanets } from "@/server/platform.functions";
import { ArrayField } from "./fields/array-field";
import { ContributionField } from "./fields/credit-field";
import { Field } from "./fields/field";
import type { RiskLevel } from "./fields/risk-select";
import { RiskSelect } from "./fields/risk-select";
import { InstallmentScoreDesk } from "./installment-score-desk";
import { RelationshipEditor } from "./relationship";

interface WorkEditorProps {
  work: Work | null;
  works: Work[];
  entities: Entity[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

export function WorkEditor({ work, works, entities, onOpenChange, onSaved }: WorkEditorProps) {
  if (!work) return null;

  return (
    <WorkEditorInner
      key={work.id}
      work={work}
      works={works}
      entities={entities}
      open={Boolean(work)}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      page={false}
    />
  );
}

export function WorkEditorPage({
  work,
  works,
  entities,
  onSaved,
}: {
  work: Work;
  works: Work[];
  entities: Entity[];
  onSaved: () => Promise<void>;
}) {
  return (
    <WorkEditorInner
      key={work.id}
      work={work}
      works={works}
      entities={entities}
      open
      page
      onOpenChange={() => undefined}
      onSaved={onSaved}
    />
  );
}

function WorkEditorInner({
  work,
  works,
  entities,
  open,
  onOpenChange,
  onSaved,
  page,
}: {
  work: Work;
  works: Work[];
  entities: Entity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  page: boolean;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [draft, setDraft] = useState<Work>(() => structuredClone(work));
  const [links, setLinks] = useState(() =>
    work.externalLinks.map((link) => `${link.provider} | ${link.label} | ${link.url}`).join("\n"),
  );
  const structureQuery = useQuery({
    queryKey: ["work-structure", work.id],
    queryFn: () =>
      page
        ? getAdminWorkStructure({ data: { workId: work.id } })
        : getWorkStructure({ data: { workId: work.id } }),
  });
  const planetsQuery = useQuery({
    queryKey: ["admin-planets"],
    queryFn: () => getAdminPlanets(),
  });

  const mutation = useMutation({
    mutationFn: saveWork,
    onSuccess: async () => {
      await onSaved();
      onOpenChange(false);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const {
      addedAt: _addedAt,
      palette: _palette,
      calculatedRating: _calculatedRating,
      relations,
      ...editable
    } = draft;

    const externalLinks = links
      .split("\n")
      .map((line) => line.split("|").map((value) => value.trim()))
      .filter((parts) => parts.length >= 3 && parts[2])
      .map(([provider, label, ...url]) => ({
        provider,
        label,
        url: url.join("|"),
      }));

    mutation.mutate({
      data: {
        ...editable,
        externalLinks,
        relations: relations.map(
          ({ id, workId, relationType, direction, notes, provenance, externalKey }) => ({
            id,
            workId,
            relationType,
            direction,
            notes,
            provenance,
            externalKey,
          }),
        ),
      } as AdminWorkUpdate,
    });
  };

  const title = `تعديل ${work.arabicTitle || work.title}`;
  const description = "مساحة تحرير موحّدة لبيانات العنوان والفهرسة والتحرير والوسائط.";
  const hasPendingChanges =
    JSON.stringify(draft) !== JSON.stringify(work) ||
    links !==
      work.externalLinks.map((link) => `${link.provider} | ${link.label} | ${link.url}`).join("\n");

  const formFields = (
    <WorkEditorFormFields
      works={works}
      entities={entities}
      draft={draft}
      setDraft={setDraft}
      links={links}
      setLinks={setLinks}
      mutation={mutation}
      structure={structureQuery.data}
      planets={planetsQuery.data ?? []}
      submit={submit}
    />
  );

  if (page) {
    return (
      <div className="flex min-w-0 flex-col gap-0">
        <EditorMasthead
          work={work}
          title={title}
          description={description}
          structure={structureQuery.data}
        />
        {formFields}
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <JsonWorkDialog work={work} />
            <span className="text-xs text-muted-foreground">
              {hasPendingChanges ? "لديك تغييرات غير محفوظة" : "كل التغييرات محفوظة"}
            </span>
          </div>
          <Button
            type="submit"
            form="admin-editor-form"
            disabled={mutation.isPending || !hasPendingChanges}
          >
            <CheckIcon data-icon="inline-start" />
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ تغييرات العنوان"}
          </Button>
        </footer>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          dir="rtl"
          className="flex h-[min(92dvh,56rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none -translate-x-1/2 flex-col gap-0 overflow-hidden rounded-xl! bg-background p-0 text-foreground sm:max-w-none lg:w-[min(72rem,calc(100vw-3rem))]"
        >
          <DialogHeader className="shrink-0 border-b bg-muted/30 p-5 text-right">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  محرر العنوان
                </p>
                <DialogTitle className="truncate font-heading text-xl font-semibold tracking-tight">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {description}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="shrink-0">
                {work.isPrivate ? "خاص" : "عام"}
              </Badge>
            </div>
          </DialogHeader>

          {formFields}

          <DialogFooter className="flex shrink-0 flex-row items-center justify-between gap-3 border-t bg-background p-4">
            <div className="flex items-center gap-3">
              <JsonWorkDialog work={work} />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {hasPendingChanges ? "تغييرات غير محفوظة" : "محدّث"}
              </span>
            </div>
            <div className="flex flex-row gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                form="admin-editor-form"
                size="sm"
                disabled={mutation.isPending || !hasPendingChanges}
              >
                <CheckIcon data-icon="inline-start" />
                {mutation.isPending ? "جارٍ الحفظ…" : "حفظ العنوان"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[90vh] flex-col gap-0 bg-background p-0 text-foreground">
        <DrawerHeader className="shrink-0 border-b bg-muted/30 p-6 text-right">
          <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            محرر العنوان
          </p>
          <DrawerTitle className="mt-1 font-heading text-xl font-semibold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="mt-1 text-xs text-muted-foreground">
            {description}
          </DrawerDescription>
        </DrawerHeader>

        {formFields}

        <DrawerFooter className="flex shrink-0 flex-row items-center justify-between gap-3 border-t bg-background p-4">
          <JsonWorkDialog work={work} />
          <div className="flex flex-row gap-2">
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
              disabled={mutation.isPending || !hasPendingChanges}
            >
              <CheckIcon data-icon="inline-start" />
              {mutation.isPending ? "جارٍ الحفظ…" : "حفظ العنوان"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// --- Add these near your other module-level constants (e.g. next to `workKinds`) ---

function EditorMasthead({
  work,
  title,
  description,
  structure,
}: {
  work: Work;
  title: string;
  description: string;
  structure: WorkStructure | undefined;
}) {
  return (
    <header className="flex flex-col gap-5 border-b bg-muted/20 px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            لوحة التحرير
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{kindLabels[work.kind]}</Badge>
          {work.year && <Badge variant="outline">{work.year}</Badge>}
          {work.isPrivate && <Badge variant="outline">خاص</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span>الأجزاء: {structure?.seasons.length ?? "—"}</span>
        <span>الحلقات: {structure?.totalUnits ?? "—"}</span>
        <span>العلاقات: {work.relations.length}</span>
        <span>آخر مراجعة: {work.curation?.reviewedAt ?? "غير مسجّلة"}</span>
      </div>
    </header>
  );
}

type StructureField = "runtime" | "episodes";

// Which structure/tracking fields apply to each work kind — this is what was
// missing before (showRuntime etc. were hardcoded to `true`, so every kind
// showed all seven fields). Adjust these slugs to match your actual WorkKind
// union. A kind that isn't listed falls back to showing everything, so
// nothing silently disappears for a kind you add later and forget to map.
const STRUCTURE_FIELDS_BY_KIND: Partial<Record<string, StructureField[]>> = {
  movie: ["runtime"],
  series: ["runtime", "episodes"],
  anime: ["runtime", "episodes"],
};
const MEDIA_WORK_KINDS = workKinds.filter((kind) => ["movie", "series", "anime"].includes(kind));

// --- component ---

function WorkEditorFormFields({
  works,
  entities,
  draft,
  setDraft,
  links,
  setLinks,
  mutation,
  structure,
  planets,
  submit,
}: {
  works: Work[];
  entities: Entity[];
  draft: Work;
  setDraft: React.Dispatch<React.SetStateAction<Work>>;
  links: string;
  setLinks: React.Dispatch<React.SetStateAction<string>>;
  mutation: { isPending: boolean; error: Error | null };
  structure?: WorkStructure;
  planets: PlanetWithWorks[];
  submit: (e: FormEvent) => void;
}) {
  const { taxonomyLabel } = useArabicTranslations();

  const structureFields = STRUCTURE_FIELDS_BY_KIND[String(draft.kind)] ?? ["runtime"];
  const showRuntime = structureFields.includes("runtime");
  const showEpisodes = structureFields.includes("episodes");

  const changeKind = (kind: WorkKind) => setDraft({ ...draft, kind });
  const tagOptions = useMemo(
    () => [...new Set(works.flatMap((candidate) => candidate.tags))].sort(),
    [works],
  );

  return (
    <form
      id="admin-editor-form"
      className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6"
      onSubmit={submit}
    >
      <Tabs defaultValue="overview" className="gap-6">
        <div className="flex flex-col gap-4 border-b pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                مساحة تحرير العنوان
              </p>
              <p className="text-sm text-muted-foreground">
                احفظ بيانات العنوان من الزر السفلي، واحفظ تقييمات الأجزاء من تبويب التحرير.
              </p>
            </div>
            <Badge variant="outline">{draft.isPrivate ? "خاص" : "ظاهر للعامة"}</Badge>
          </div>
          <TabsList
            variant="line"
            className="w-full max-w-full justify-start overflow-x-auto rounded-none p-0"
          >
            <TabsTrigger value="overview" className="shrink-0">
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="catalog" className="shrink-0">
              الفهرسة
            </TabsTrigger>
            <TabsTrigger value="editorial" className="shrink-0">
              التحرير
            </TabsTrigger>
            <TabsTrigger value="assets" className="shrink-0">
              الصور والظهور
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <EditorSection
            title="بنية العرض"
            description="مدة العرض وعدد الحلقات المشتق من مواسم وأفلام PostgreSQL v2. تُدار التفاصيل الدقيقة من تبويب الأجزاء والحلقات."
            subClassname="sm:grid-cols-2! lg:grid-cols-4!"
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
                      runtimeMinutes: e.target.value ? Number(e.target.value) : null,
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
                      episodeCount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
            )}
            <div className="col-span-full">
              <StructureSummary structure={structure} />
            </div>
          </EditorSection>

          {/* Identity Section */}
          <EditorSection
            title="الهوية"
            description="الحقول الأساسية المستخدمة في جميع أنحاء نحّاسينما."
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
                items={MEDIA_WORK_KINDS.map((kind) => ({ value: kind, label: kindLabels[kind] }))}
                value={draft.kind}
                onValueChange={(value) => changeKind(value as WorkKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MEDIA_WORK_KINDS.map((kind) => (
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
                items={["upcoming", "airing", "returning", "completed", "unknown"].map(
                  (status) => ({
                    value: status,
                    label: taxonomyLabel("release-status", status),
                  }),
                )}
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
                    {["upcoming", "airing", "returning", "completed", "unknown"].map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {taxonomyLabel("release-status", status)}
                      </SelectItem>
                    ))}
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
        </TabsContent>

        <TabsContent value="catalog" className="flex flex-col gap-6">
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
              onChange={(nextGenres: string[]) => setDraft({ ...draft, genres: nextGenres })}
              options={genres}
              optionLabels={taxonomyLabels.genres}
              maxItems={4}
            />
            <ArrayField
              label="الوسوم والموضوعات"
              value={draft.tags}
              onChange={(tags: string[]) => setDraft({ ...draft, tags })}
              options={tagOptions}
              allowCustom
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
            <Field label="الكوكب">
              <Select
                items={planets.map((planet) => ({ value: planet.id, label: planet.nameAr }))}
                value={draft.planetId ?? null}
                onValueChange={(planetId) => setDraft({ ...draft, planetId: planetId || null })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="لا يوجد كوكب معيّن" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {planets.map((planet) => (
                      <SelectItem key={planet.id} value={planet.id} disabled={!planet.isActive}>
                        {planet.icon} {planet.nameAr}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="الجمهور">
              <Select
                items={audiences.map((audience) => ({
                  value: audience,
                  label: taxonomyLabels.audiences[audience],
                }))}
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
              onChange={(sharedWith: string[]) => setDraft({ ...draft, sharedWith })}
            />

            <ContributionField
              value={draft.contributors}
              entities={entities}
              onChange={(contributors) => setDraft({ ...draft, contributors })}
            />
          </EditorSection>

          <EditorSection
            title="الأعمال المرتبطة"
            description="اربط الاقتباسات والتكملات وسجلات الوسائط الأخرى."
            subClassname="sm:grid-cols-1!"
          >
            <RelationshipEditor
              work={draft}
              works={works}
              onChange={(relations: Work["relations"]) => setDraft({ ...draft, relations })}
            />
          </EditorSection>
        </TabsContent>

        <TabsContent value="editorial" className="flex flex-col gap-6">
          <EditorSection
            title="التقييم التحريري"
            description="التقييمات تخص المواسم والأفلام والأعمال الخاصة، لا العنوان المظلي. عدّل كل جزء واحفظه مستقلاً."
            subClassname="sm:grid-cols-1!"
          >
            <InstallmentScoreDesk structure={structure} workKind={draft.kind} />
          </EditorSection>

          {/* Guidance & Analysis Section */}
          <EditorSection
            title="إرشادات المحتوى والتحليل"
            description="تبقى إرشادات المحتوى منفصلة عن البيانات الموضوعية."
            subClassname="sm:grid-cols-2! lg:grid-cols-3!"
          >
            <Field label="مخاطر المحتوى الجنسي">
              <RiskSelect
                value={draft.riskProfile?.sexuality ?? "unknown"}
                onChange={(sexuality: RiskLevel) =>
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
                onChange={(behavioral: RiskLevel) =>
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
                onChange={(theology: RiskLevel) =>
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
                onChange={(e) => setDraft({ ...draft, contentWarnings: e.target.value || null })}
              />
            </Field>

            <Field label="ملاحظات التحليل" wide>
              <Textarea
                dir="rtl"
                lang="ar"
                rows={4}
                value={draft.analysisNotes ?? ""}
                onChange={(e) => setDraft({ ...draft, analysisNotes: e.target.value || null })}
              />
            </Field>
          </EditorSection>

          {/* Dates, Source & Links Section */}
          <EditorSection
            title="التواريخ والمصدر والروابط"
            description="سياق النشر والوجهات خارج نحّاسينما."
          >
            <p className="col-span-full text-xs font-semibold text-muted-foreground">
              تواريخ الإصدار
            </p>
            <Field label="بداية الإصدار">
              <Input
                type="date"
                value={draft.releaseStart ?? ""}
                onChange={(e) => setDraft({ ...draft, releaseStart: e.target.value || null })}
              />
            </Field>

            <Field label="نهاية الإصدار">
              <Input
                type="date"
                value={draft.releaseEnd ?? ""}
                onChange={(e) => setDraft({ ...draft, releaseEnd: e.target.value || null })}
              />
            </Field>

            <p className="col-span-full mt-2 text-xs font-semibold text-muted-foreground">
              مصدر الاقتباس
            </p>
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

            <p className="col-span-full mt-2 text-xs font-semibold text-muted-foreground">
              روابط خارجية
            </p>
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
                items={[
                  { value: "provisional", label: "مبدئي" },
                  { value: "verified", label: "موثّق" },
                ]}
                value={draft.curation?.status ?? "provisional"}
                onValueChange={(status) =>
                  setDraft({
                    ...draft,
                    curation: {
                      reviewedAt:
                        draft.curation?.reviewedAt ?? new Date().toISOString().slice(0, 10),
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
                  <SelectGroup>
                    <SelectItem value="provisional">مبدئي</SelectItem>
                    <SelectItem value="verified">موثّق</SelectItem>
                  </SelectGroup>
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
                        draft.curation?.reviewedAt ?? new Date().toISOString().slice(0, 10),
                      status: draft.curation?.status ?? "provisional",
                      notes: e.target.value || null,
                    },
                  })
                }
              />
            </Field>
          </EditorSection>
        </TabsContent>

        <TabsContent value="assets" className="flex flex-col gap-6">
          <EditorSection
            title="الظهور والصور"
            description="العمل الخاص لا يظهر في المنصة. غيّر صورة واحدة في كل مرة، راجع المعاينة، ثم أكّد استخدامها."
          >
            <Field label="ظهور العمل" wide>
              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <LockKeyIcon />
                  <div>
                    <p className="text-sm font-medium">عمل خاص</p>
                    <p className="text-xs text-muted-foreground">يُخفى من المنصة والبحث العام.</p>
                  </div>
                </div>
                <Switch
                  checked={draft.isPrivate}
                  onCheckedChange={(isPrivate) => setDraft({ ...draft, isPrivate })}
                />
              </div>
            </Field>
            <div className="col-span-full grid gap-4 sm:grid-cols-3">
              <ArtworkField
                label="الملصق"
                assetType="poster"
                ownerName={draft.title}
                value={draft.imagePath}
                onChange={(imagePath) => setDraft({ ...draft, imagePath })}
              />
              <ArtworkField
                label="الغلاف"
                assetType="banner"
                ownerName={draft.title}
                value={draft.bannerPath}
                onChange={(bannerPath) => setDraft({ ...draft, bannerPath })}
              />
              <ArtworkField
                label="الشعار"
                assetType="logo"
                ownerName={draft.title}
                value={draft.logoPath}
                onChange={(logoPath) => setDraft({ ...draft, logoPath })}
              />
            </div>
            {structure && (
              <div className="col-span-full">
                <SeasonArtworkManager structure={structure} workTitle={draft.title} />
              </div>
            )}
          </EditorSection>
        </TabsContent>

        {/* Error Alert */}
        {mutation.error && (
          <Alert variant="destructive">
            <InfoIcon className="size-4" />
            <AlertDescription>{mutation.error.message}</AlertDescription>
          </Alert>
        )}
      </Tabs>
    </form>
  );
}

function JsonWorkDialog({ work }: { work: Work }) {
  const document = {
    schemaVersion: 3,
    title: {
      id: work.id,
      canonicalTitle: work.title,
      titleAr: work.arabicTitle,
      aliases: work.aliases,
      summary: work.summary,
      releaseYear: work.year,
      isPrivate: work.isPrivate,
      planetId: work.planetId,
      genres: work.genres,
      tones: work.tone,
      tags: work.tags,
      countries: work.country,
      audience: work.audience,
      risks: work.riskProfile,
      contentWarnings: work.contentWarnings,
      analysisNotes: work.analysisNotes,
      externalIdentities: work.externalLinks.map((identity) => ({
        provider: identity.provider,
        externalId: identity.label,
        url: identity.url,
      })),
      credits: work.contributors.map((credit) => ({
        entityId: credit.entityId,
        role: credit.role,
        isPrimary: credit.isPrimary,
      })),
      relationships: work.relations.map((relationship) => ({
        targetTitleId: relationship.workId,
        kind: relationship.relationType,
        direction: relationship.direction,
        notes: relationship.notes,
      })),
      posterPath: work.imagePath,
      bannerPath: work.bannerPath,
      logoPath: work.logoPath,
    },
  };
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        <CodeIcon data-icon="inline-start" /> عرض JSON
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[80dvh] overflow-scroll sm:max-w-2xl">
        <DialogHeader className="text-right">
          <DialogTitle>JSON الخام للسجل</DialogTitle>
          <DialogDescription>للقراءة فقط؛ يعرض آخر نسخة محفوظة من السجل.</DialogDescription>
        </DialogHeader>
        <Textarea
          readOnly
          value={JSON.stringify(document, null, 2)}
          rows={18}
          className="resize-y font-mono text-xs ltr"
        />
      </DialogContent>
    </Dialog>
  );
}

function ArtworkField({
  label,
  assetType,
  ownerName,
  value,
  onChange,
}: {
  label: string;
  assetType: "poster" | "banner" | "logo";
  ownerName: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const fileInputId = useId();
  const upload = useMutation({ mutationFn: uploadWorkImage });
  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        upload.mutate(
          { data: { dataUrl: reader.result, fileName: file.name, assetType, ownerName } },
          { onSuccess: ({ relativePath }) => setCandidate(relativePath) },
        );
      }
    };
    reader.readAsDataURL(file);
  };
  const preview = candidate || value;
  const aspectRatio =
    assetType === "banner"
      ? "aspect-video"
      : assetType === "logo"
        ? "aspect-square"
        : "aspect-[2/3]";

  return (
    <Field label={label}>
      <Card size="sm" className="gap-3 bg-muted/20 py-4 shadow-none">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">{label}</CardTitle>
          <CardDescription>
            {assetType === "banner"
              ? "يفضّل غلاف عريض بنسبة 16:9."
              : assetType === "logo"
                ? "يفضّل شعاراً مربعاً بنسبة 1:1."
                : "يفضّل ملصق عمودي بنسبة 2:3."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="grid grid-cols-2 gap-3">
            <ArtworkPreview
              label="الحالي"
              src={value}
              alt={`الصورة الحالية لـ ${label}`}
              aspectRatio={aspectRatio}
            />
            <ArtworkPreview
              label="المعاينة"
              src={preview}
              alt={`معاينة ${label}`}
              aspectRatio={aspectRatio}
              isNew={Boolean(candidate && value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 px-4">
          <Input
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
            placeholder="ألصق رابط الصورة أو مسارها"
            dir="ltr"
          />
          <Input
            id={fileInputId}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={uploadFile}
          />
          {upload.error ? <p className="text-xs text-destructive">{upload.error.message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Label
              htmlFor={fileInputId}
              aria-disabled={upload.isPending}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                upload.isPending && "pointer-events-none opacity-50",
              )}
            >
              <UploadSimpleIcon data-icon="inline-start" />
              {upload.isPending ? "جارٍ رفع الصورة…" : "اختر صورة"}
            </Label>
            <Button
              type="button"
              size="sm"
              disabled={!candidate}
              onClick={() => {
                onChange(candidate);
                setCandidate("");
              }}
            >
              <CheckIcon data-icon="inline-start" /> اعتماد
            </Button>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                <TrashIcon data-icon="inline-start" /> إزالة
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>
    </Field>
  );
}

function ArtworkPreview({
  label,
  src,
  alt,
  aspectRatio,
  isNew = false,
}: {
  label: string;
  src: string | null;
  alt: string;
  aspectRatio: string;
  isNew?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {isNew && <Badge variant="secondary">جديد</Badge>}
      </div>
      <div
        className={cn("overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10", aspectRatio)}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className={cn(
              "size-full object-cover",
              aspectRatio === "aspect-square" && "object-contain",
            )}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageSquareIcon className="size-5" />
            <span className="text-center text-xs">لا توجد صورة</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StructureSummary({ structure }: { structure: WorkStructure | undefined }) {
  if (!structure) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
        جارٍ تحميل سجل البنية…
      </div>
    );
  }

  if (structure.totalUnits === 0 && structure.seasons.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
        <span>لم تُعرّف مواسم أو وحدات مستقلة لهذا العمل بعد.</span>
        <StructureJsonEditor structure={structure} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:col-span-2">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-400">
          السجل المنظّم
        </span>
        <span className="text-xs text-muted-foreground">
          اكتمل {structure.completedUnits}/{structure.totalUnits}
        </span>
        <StructureJsonEditor structure={structure} />
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        {structure.seasons.map((season) => {
          const completed = season.units.filter(
            (unit) => unit.progress?.status === "completed",
          ).length;
          const isComplete =
            season.progress?.status === "completed" ||
            (season.units.length > 0 && completed === season.units.length);
          return (
            <span
              key={season.id}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs"
            >
              {isComplete && <CheckIcon className="size-3.5 text-amber-600" weight="bold" />}
              <strong className="font-medium">{season.title}</strong>
              <span className="font-mono text-[10px] text-muted-foreground">
                {completed}/{season.units.length || season.unitCount || "—"}
              </span>
            </span>
          );
        })}
        {structure.ungroupedUnits.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs">
            <strong className="font-medium capitalize">
              {structure.ungroupedUnits[0].unitType}s
            </strong>
            <span className="font-mono text-[10px] text-muted-foreground">
              {
                structure.ungroupedUnits.filter((unit) => unit.progress?.status === "completed")
                  .length
              }
              /{structure.ungroupedUnits.length}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function SeasonArtworkManager({
  structure,
  workTitle,
}: {
  structure: WorkStructure;
  workTitle: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: saveWorkStructure,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-structure", structure.workId] });
    },
  });
  const savePoster = (seasonId: string, posterPath: string | null) => {
    const editable = parseEditableStructure(
      JSON.stringify(editableStructure(structure)),
      structure.workId,
    );
    mutation.mutate({
      data: {
        workId: editable.workId,
        ungroupedUnits: editable.ungroupedUnits,
        seasons: editable.seasons.map((season) =>
          season.id === seasonId ? { ...season, posterPath } : season,
        ),
      },
    });
  };

  if (!structure.seasons.length) return null;

  return (
    <Card size="sm" className="gap-4 border-dashed bg-muted/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-sm">ملصقات المواسم والأجزاء</CardTitle>
        <CardDescription>
          يغيّر الحفظ ملصق الجزء فقط، ولا يعدّل ملصق العمل الرئيسي أو بيانات حلقاته.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {structure.seasons.map((season) => (
          <SeasonPosterCard
            key={season.id}
            season={season}
            workTitle={workTitle}
            disabled={mutation.isPending}
            onSave={(posterPath) => savePoster(season.id, posterPath)}
          />
        ))}
      </CardContent>
      {mutation.error && (
        <CardFooter className="px-4">
          <Alert variant="destructive">
            <AlertDescription>{mutation.error.message}</AlertDescription>
          </Alert>
        </CardFooter>
      )}
    </Card>
  );
}

function SeasonPosterCard({
  season,
  workTitle,
  disabled,
  onSave,
}: {
  season: WorkStructure["seasons"][number];
  workTitle: string;
  disabled: boolean;
  onSave: (posterPath: string | null) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const fileInputId = useId();
  const upload = useMutation({ mutationFn: uploadWorkImage });
  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        upload.mutate(
          {
            data: {
              dataUrl: reader.result,
              fileName: file.name,
              assetType: "poster",
              ownerName: `${workTitle} ${season.installmentKind} ${season.position + 1}`,
            },
          },
          { onSuccess: ({ relativePath }) => setCandidate(relativePath) },
        );
      }
    };
    reader.readAsDataURL(file);
  };
  const preview = candidate || season.posterPath;

  return (
    <Card size="sm" className="gap-3 bg-background py-4 shadow-none">
      <CardHeader className="px-4">
        <CardTitle className="truncate text-sm">{season.title}</CardTitle>
        <CardDescription>
          {season.installmentKind === "season" ? `الموسم ${season.position}` : "جزء مستقل"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className="aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
          {preview ? (
            <img src={preview} alt={`ملصق ${season.title}`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageSquareIcon className="size-6" />
              <span className="text-xs">بانتظار ملصق</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 px-4">
        <Input
          value={candidate}
          onChange={(event) => setCandidate(event.target.value)}
          placeholder="رابط أو مسار الملصق"
          dir="ltr"
          disabled={disabled}
        />
        <Input
          id={fileInputId}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={uploadFile}
          disabled={disabled || upload.isPending}
        />
        {upload.error ? <p className="text-xs text-destructive">{upload.error.message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Label
            htmlFor={fileInputId}
            aria-disabled={disabled || upload.isPending}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              (disabled || upload.isPending) && "pointer-events-none opacity-50",
            )}
          >
            <UploadSimpleIcon data-icon="inline-start" />
            {upload.isPending ? "جارٍ الرفع…" : "اختر صورة"}
          </Label>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !candidate}
            onClick={() => {
              onSave(candidate);
              setCandidate("");
            }}
          >
            <CheckIcon data-icon="inline-start" /> حفظ الملصق
          </Button>
          {season.posterPath ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onSave(null)}
            >
              <TrashIcon data-icon="inline-start" /> إزالة
            </Button>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}

function structureDate(timestamp: number | null) {
  return timestamp === null ? null : new Date(timestamp).toISOString().slice(0, 10);
}

function parseStructureDate(value: unknown, path: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path} يجب أن يكون بالتنسيق YYYY-MM-DD أو null.`);
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`${path} ليس تاريخاً صحيحاً.`);
  }
  return timestamp;
}

function editableStructure(structure: WorkStructure) {
  return {
    schemaVersion: 3,
    installments: structure.seasons.map((installment) => ({
      id: installment.id,
      kind: installment.installmentKind ?? "season",
      title: installment.title,
      summary: installment.summary ?? "",
      status: installment.releaseStatus ?? "unknown",
      position: installment.position,
      releaseDate: structureDate(installment.releaseAt),
      runtimeMinutes: installment.runtimeMinutes,
      posterPath: installment.posterPath ?? null,
      score: installment.score,
      episodes: installment.units.map((episode) => ({
        id: episode.id,
        title: episode.title,
        number: episode.unitNumber,
        position: episode.position,
        releaseDate: structureDate(episode.releaseAt),
        runtimeMinutes: episode.runtimeMinutes,
      })),
    })),
  };
}

function parseEditableStructure(raw: string, workId: string): EditableWorkStructure {
  const document = JSON.parse(raw) as {
    schemaVersion?: unknown;
    installments?: Array<Record<string, unknown>>;
  };
  if (document.schemaVersion !== 3 || !Array.isArray(document.installments)) {
    throw new Error("يجب أن يحتوي المستند على schemaVersion: 3 ومصفوفة installments.");
  }
  return editableWorkStructureSchema.parse({
    workId,
    seasons: document.installments.map((installment, installmentIndex) => {
      const episodes = Array.isArray(installment.episodes) ? installment.episodes : [];
      return {
        id: installment.id,
        title: installment.title,
        installmentKind: installment.kind,
        summary: installment.summary ?? "",
        releaseStatus: installment.status ?? "unknown",
        posterPath: installment.posterPath ?? null,
        score: installment.score,
        seasonNumber: installment.kind === "season" ? Number(installment.position ?? 0) : null,
        position: installment.position,
        runtimeMinutes: installment.runtimeMinutes ?? null,
        unitCount: episodes.length,
        releaseAt: parseStructureDate(
          installment.releaseDate,
          `installments.${installmentIndex}.releaseDate`,
        ),
        units: episodes.map((episode, episodeIndex) => {
          if (!episode || typeof episode !== "object" || Array.isArray(episode)) {
            throw new Error(`installments.${installmentIndex}.episodes.${episodeIndex} غير صالح.`);
          }
          const value = episode as Record<string, unknown>;
          return {
            id: value.id,
            unitType: "episode",
            title: value.title ?? null,
            unitNumber: value.number ?? null,
            position: value.position,
            runtimeMinutes: value.runtimeMinutes ?? null,
            releaseAt: parseStructureDate(
              value.releaseDate,
              `installments.${installmentIndex}.episodes.${episodeIndex}.releaseDate`,
            ),
          };
        }),
      };
    }),
    ungroupedUnits: [],
  });
}

function StructureJsonEditor({ structure }: { structure: WorkStructure }) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState(() => JSON.stringify(editableStructure(structure), null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  useEffect(() => {
    setRaw(JSON.stringify(editableStructure(structure), null, 2));
    setParseError(null);
  }, [structure]);
  const mutation = useMutation({
    mutationFn: saveWorkStructure,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-structure", structure.workId] });
    },
  });
  const save = () => {
    try {
      const data = parseEditableStructure(raw, structure.workId);
      setParseError(null);
      mutation.mutate({ data });
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "JSON غير صالح");
    }
  };
  return (
    <Drawer>
      <DrawerTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <CodeIcon data-icon="inline-start" />
            تعديل البنية
          </Button>
        }
      />
      <DrawerContent className="flex h-[90dvh] flex-col" dir="rtl">
        <DrawerHeader className="text-right">
          <DrawerTitle>تحرير المواسم والأفلام والحلقات</DrawerTitle>
          <DrawerDescription>
            أضف موسماً أو فيلماً أو عملاً خاصاً، ثم حرّر صوره وتاريخه وتقييمه وحلقاته. لا تدعم بنية v2
            الفصول أو المجلدات.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <Textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            className="min-h-full font-mono text-xs ltr"
            dir="ltr"
            aria-invalid={Boolean(parseError || mutation.error)}
          />
          {(parseError || mutation.error) && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{parseError ?? mutation.error?.message}</AlertDescription>
            </Alert>
          )}
        </div>
        <DrawerFooter>
          <Button type="button" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ البنية"}
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" />}>إغلاق</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

interface EditorSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  subClassname?: string;
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
        "flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 border-b border-border/60 pb-4">
        <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>

      <div className={cn(subClassname, "grid grid-cols-1 items-start gap-5 sm:grid-cols-2")}>
        {children}
      </div>
    </section>
  );
}
