"use client";

import type { ArtworkCandidate, ArtworkProvider } from "@arcadia/contracts";
import {
  CheckIcon,
  CodeIcon,
  DatabaseIcon,
  GlobeIcon,
  ImageSquareIcon,
  InfoIcon,
  LockKeyIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  StackIcon,
  TrashIcon,
  TrophyIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { z } from "zod";
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
  ageValues,
  audiences,
  countries,
  editableWorkStructureSchema,
  genres,
  tagLabelsAr,
  taxonomyLabels,
  tones,
  workflowStatusValues,
  workKinds,
} from "@/features/library/model";

import { useArabicTranslations } from "@/features/library/translations";

import type { PlanetWithWorks } from "@/features/platform/model";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  getAdminWorkStructure,
  getMediaAssets,
  getWorkStructure,
  ingestArtwork,
  saveWork,
  saveWorkStructure,
  searchArtwork,
  uploadWorkImage,
} from "@/server/library.functions";
import { getAdminPlanets } from "@/server/platform.functions";
import { TitleAwardsPanel } from "../../awards/title-awards-panel";
import { ArrayField } from "./fields/array-field";
import { ContributionField } from "./fields/credit-field";
import { Field } from "./fields/field";
import type { RiskLevel } from "./fields/risk-select";
import { RiskSelect } from "./fields/risk-select";
import { InstallmentScoreDesk } from "./installment-score-desk";
import { RelationshipEditor } from "./relationship";

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
      // Awards are no longer part of the title's own save payload — the Awards tab saves each
      // recognition immediately via TitleAwardsPanel/AwardRecognitionForm. Sending this array
      // would resurrect the retired legacy delete-then-reinsert path on the API.
      awards: _awards,
      // These are read-only/derived fields on `Work` that `AdminWorkUpdate` (built from
      // `workSchema.omit(...)`) doesn't accept — drop them from the save payload the same way
      // the schema does.
      catalogUpdatedAt: _catalogUpdatedAt,
      personalUpdatedAt: _personalUpdatedAt,
      scoreCoverage: _scoreCoverage,
      animationStudios: _animationStudios,
      productionCompanies: _productionCompanies,
      publishers: _publishers,
      isSequelMovie: _isSequelMovie,
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
      // SAFETY: `editable.genres`/`editable.tone` are typed as plain `string[]` on `Work` (it
      // covers non-admin contexts too), but every value in them was added through this form's
      // genre/tone `ArrayField`s, which only accept values from the `genres`/`tones` option
      // lists (no `allowCustom`) — so at runtime they're always valid `Genre`/`Tone` members,
      // matching `AdminWorkUpdate`'s narrower `genreSchema`/`toneSchema` array types.
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
        <footer className="sticky bottom-2 flex flex-wrap items-center justify-between gap-3 border bg-background/95 p-2 backdrop-blur rounded-full mb-2">
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
    <header className="flex flex-col gap-5 border bg-muted/20 px-6 py-6 sm:px-8 ml-2 rounded-3xl">
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
          <Badge variant={work.isPrivate ? "destructive" : "outline"}>
            {work.isPrivate ? "خاص" : "ظاهر للعامة"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span>الأجزاء: {structure?.seasons.length ?? "—"}</span>
        <span>الحلقات: {structure?.totalUnits ?? "—"}</span>
        <span>العلاقات: {work.relations.length}</span>
        <span>آخر مراجعة: {work.verifiedAt?.slice(0, 10) ?? "غير مسجّلة"}</span>
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
const STRUCTURE_FIELDS_BY_KIND = {
  movie: ["runtime"],
  series: ["runtime", "episodes"],
  anime: ["runtime", "episodes"],
} satisfies Partial<Record<string, StructureField[]>>;

function hasStructureFields(kind: string): kind is keyof typeof STRUCTURE_FIELDS_BY_KIND {
  return kind in STRUCTURE_FIELDS_BY_KIND;
}
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

  const draftKind = String(draft.kind);
  const structureFields = hasStructureFields(draftKind)
    ? STRUCTURE_FIELDS_BY_KIND[draftKind]
    : ["runtime"];
  const showRuntime = structureFields.includes("runtime");
  const showEpisodes = structureFields.includes("episodes");

  const changeKind = (kind: WorkKind) => setDraft({ ...draft, kind });
  const tagOptions = useMemo(
    () => [...new Set(works.flatMap((candidate) => candidate.tags))].toSorted(),
    [works],
  );

  return (
    <form
      id="admin-editor-form"
      className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-8 overflow-y-auto p-4 sm:p-6"
      onSubmit={submit}
    >
      <Tabs defaultValue="overview" className="min-w-0 max-w-full gap-6 ">
        <div className="flex flex-col gap-4">
          <TabsList
            variant="line"
            className="w-full max-w-full justify-start overflow-x-auto border-b px-1"
          >
            <TabsTrigger value="overview" className="shrink-0">
              <InfoIcon data-icon="inline-start" /> نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="structure" className="shrink-0">
              <StackIcon data-icon="inline-start" /> البنية
              {structure ? <Badge variant="secondary">{structure.seasons.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="catalog" className="shrink-0">
              <DatabaseIcon data-icon="inline-start" /> الفهرسة
            </TabsTrigger>
            <TabsTrigger value="editorial" className="shrink-0">
              <NotePencilIcon data-icon="inline-start" /> التحرير
            </TabsTrigger>
            <TabsTrigger value="awards" className="shrink-0">
              <TrophyIcon data-icon="inline-start" />
              الجوائز
              {draft.awards.length > 0 ? (
                <Badge variant="secondary">{draft.awards.length}</Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="assets" className="shrink-0">
              <ImageSquareIcon data-icon="inline-start" /> الصور والظهور
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-6">
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
                onValueChange={(value) => value && changeKind(value)}
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
                  value &&
                  setDraft({
                    ...draft,
                    releaseStatus: value,
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

        <TabsContent value="structure" className="flex flex-col gap-6">
          <EditorSection
            title="الأجزاء والحلقات"
            description="البنية الفعلية للعنوان في PostgreSQL v2: المواسم والأفلام والمواد الخاصة والحلقات المرتبطة بها."
            subClassname="sm:grid-cols-2! lg:grid-cols-4!"
          >
            {showRuntime && (
              <Field label="مدة العرض الافتراضية (بالدقائق)">
                <Input
                  type="number"
                  min="0"
                  value={draft.runtimeMinutes ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      runtimeMinutes: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </Field>
            )}
            {showEpisodes && (
              <div className="flex flex-col gap-2 rounded-xl border p-3">
                <span className="text-xs text-muted-foreground">الحلقات المشتقة</span>
                <strong className="font-mono text-2xl tabular-nums">
                  {structure?.totalUnits ?? draft.episodeCount ?? 0}
                </strong>
              </div>
            )}
            <div className="col-span-full">
              <StructureSummary structure={structure} />
            </div>
          </EditorSection>
          <InstallmentScoreDesk structure={structure} workKind={draft.kind} />
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
                // SAFETY: ArrayField only calls onChange with values it accepted through addTag,
                // which rejects anything not in `options` whenever `allowCustom` is unset (it is,
                // here) — since `options={countries}` below, every element is a real `Country`.
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
                    audience,
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
            <Field label="تصنيف السن">
              <Select
                items={ageValues.map((age) => ({ value: age, label: taxonomyLabels.ages[age] }))}
                value={draft.age ?? "all"}
                onValueChange={(age) => age && age !== "all" && setDraft({ ...draft, age })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر تصنيف السن" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ageValues.map((age) => (
                      <SelectItem key={age} value={age}>
                        {taxonomyLabels.ages[age]}
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

        <TabsContent value="awards" className="flex flex-col gap-6">
          <TitleAwardsPanel titleId={draft.id} titleLabel={draft.arabicTitle || draft.title} />
        </TabsContent>

        <TabsContent value="editorial" className="flex flex-col gap-6">
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

            <div className="sm:col-span-3 flex gap-4">
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
            </div>
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

            <IdField
              label="TMDB"
              value={draft.tmdbId}
              onChange={(value) => setDraft({ ...draft, tmdbId: value })}
              openUrl={(value) => `https://www.themoviedb.org/movie/${value}`}
            />
            <IdField
              label="IMDb"
              value={draft.imdbId}
              onChange={(value) => setDraft({ ...draft, imdbId: value })}
              numeric={false}
              placeholder="tt0133093"
              openUrl={(value) => `https://www.imdb.com/title/${value}`}
            />
            <IdField
              label="TVDB"
              value={draft.tvdbId}
              onChange={(value) => setDraft({ ...draft, tvdbId: value })}
              openUrl={(value) => `https://thetvdb.com/dereferrer/series/${value}`}
            />
            <IdField
              label="AniList"
              value={draft.anilistId}
              onChange={(value) => setDraft({ ...draft, anilistId: value })}
              openUrl={(value) => `https://anilist.co/anime/${value}`}
            />
            <IdField
              label="MyAnimeList"
              value={draft.malId}
              onChange={(value) => setDraft({ ...draft, malId: value })}
              openUrl={(value) => `https://myanimelist.net/anime/${value}`}
            />

            <Field label="الروابط الخارجية" wide>
              <Textarea
                rows={4}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="AniList | AniList | https://…"
              />
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                الصيغة: المزوّد | التسمية | الرابط (رابط واحد في كل سطر) — لا تُستخدم لمعرّفات TMDB أو
                IMDb أو AniList، فهذه معرّفات مكتوبة أعلاه. استخدم المزوّد "trailer" لرابط الإعلان
                الرسمي كي تلتقطه صفحة العمل تلقائياً.
              </p>
            </Field>
          </EditorSection>

          <EditorSection
            title="النشر"
            description="حالة سير العمل التحريرية، الدرجة الداخلية، وتاريخ التحقق."
          >
            <Field label="حالة سير العمل">
              <Select
                items={workflowStatusValues.map((status) => ({
                  value: status,
                  label: taxonomyLabels.workflowStatuses[status],
                }))}
                value={draft.workflowStatus ?? "draft"}
                onValueChange={(status) => status && setDraft({ ...draft, workflowStatus: status })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {workflowStatusValues.map((status) => (
                      <SelectItem key={status} value={status}>
                        {taxonomyLabels.workflowStatuses[status]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="درجة الجودة">
              <Input
                type="number"
                min="0"
                value={draft.qualityScore ?? 0}
                onChange={(e) => setDraft({ ...draft, qualityScore: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="تاريخ التحقق">
              <Input
                type="date"
                value={draft.verifiedAt?.slice(0, 10) ?? ""}
                onChange={(e) => setDraft({ ...draft, verifiedAt: e.target.value || null })}
              />
            </Field>
            <Field label="ملاحظات المحرر" wide>
              <Textarea
                rows={3}
                value={draft.curatorNotes ?? ""}
                onChange={(e) => setDraft({ ...draft, curatorNotes: e.target.value || null })}
              />
            </Field>
          </EditorSection>
        </TabsContent>

        <TabsContent value="assets" className="min-w-0 max-w-full flex-col gap-6">
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
            <div className="col-span-full grid min-w-0 gap-4 lg:grid-cols-3">
              <ArtworkField
                label="الملصق"
                assetType="poster"
                ownerName={draft.title}
                year={draft.year}
                kind={draft.kind === "anime" ? "anime" : "movie"}
                titleId={draft.id}
                value={draft.imagePath}
                onChange={(imagePath) => setDraft({ ...draft, imagePath })}
              />
              <ArtworkField
                label="الغلاف"
                assetType="banner"
                ownerName={draft.title}
                year={draft.year}
                kind={draft.kind === "anime" ? "anime" : "movie"}
                titleId={draft.id}
                value={draft.bannerPath}
                onChange={(bannerPath) => setDraft({ ...draft, bannerPath })}
              />
              <ArtworkField
                label="الشعار"
                assetType="logo"
                ownerName={draft.title}
                year={draft.year}
                kind={draft.kind === "anime" ? "anime" : "movie"}
                titleId={draft.id}
                value={draft.logoPath}
                onChange={(logoPath) => setDraft({ ...draft, logoPath })}
              />
            </div>
            {structure && (
              <div className="col-span-full">
                <SeasonArtworkManager
                  structure={structure}
                  workTitle={draft.title}
                  year={draft.year}
                  kind={draft.kind === "anime" ? "anime" : "movie"}
                />
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

function artworkAspectRatio(role: "poster" | "banner" | "logo") {
  return role === "banner" ? "aspect-video" : role === "logo" ? "aspect-square" : "aspect-[2/3]";
}

const artworkProviderStyle = {
  tmdb: { label: "TMDB", className: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  anilist: { label: "AniList", className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300" },
  fanart: { label: "Fanart", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
} satisfies Record<ArtworkProvider, { label: string; className: string }>;

/**
 * Shared picker used by both ArtworkField (title-level poster/banner/logo) and SeasonPosterCard
 * (per-installment posters). Picking only *selects* — nothing is downloaded here. An existing
 * asset is already stored (its path is free to preview); an external candidate is handed back
 * as-is and only fetched if the caller actually commits it (see ingestPendingArtwork below) —
 * browsing/comparing candidates shouldn't cost a download.
 */
function ArtworkPickerDialog({
  open,
  onOpenChange,
  artworkRole,
  ownerName,
  year,
  kind,
  onPickExisting,
  onPickExternal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Named artworkRole, not role — "role" as a JSX prop reads as the ARIA role attribute to
  // Biome's a11y lint, which isn't what this is.
  artworkRole: "poster" | "banner" | "logo";
  ownerName: string;
  year?: number | null;
  kind?: "anime" | "movie";
  onPickExisting: (path: string) => void;
  onPickExternal: (item: ArtworkCandidate) => void;
}) {
  const [tab, setTab] = useState<"existing" | "external">("existing");
  const [assetSearch, setAssetSearch] = useState("");
  const [externalQuery, setExternalQuery] = useState(ownerName);
  const deferredExternalQuery = useDeferredValue(externalQuery);

  const assets = useQuery({
    queryKey: ["media-picker", artworkRole, assetSearch],
    queryFn: () =>
      getMediaAssets(`?role=${artworkRole}&q=${encodeURIComponent(assetSearch)}&limit=30`),
    enabled: open && tab === "existing",
  });
  const externalResults = useQuery({
    queryKey: ["artwork-search", artworkRole, deferredExternalQuery, year, kind],
    queryFn: () =>
      searchArtwork({
        data: { title: deferredExternalQuery, year: year ?? undefined, kind, role: artworkRole },
      }),
    enabled: open && tab === "external" && deferredExternalQuery.trim().length > 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>اختيار صورة</DialogTitle>
          <DialogDescription>
            إعادة استخدام صورة موجودة أو اختيار نتيجة من مصدر خارجي لا يغيّر الصورة الحالية بعد؛
            التنزيل والتغيير يحدثان فقط بعد الضغط على زر الاعتماد.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(next) => {
            // SAFETY: the only two TabsTrigger values below are "existing" and "external".
            setTab(next as typeof tab);
          }}
        >
          <TabsList>
            <TabsTrigger value="existing">
              <ImageSquareIcon data-icon="inline-start" /> مستخدم من قبل
            </TabsTrigger>
            <TabsTrigger value="external">
              <GlobeIcon data-icon="inline-start" /> بحث خارجي
            </TabsTrigger>
          </TabsList>
          <TabsContent value="existing" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MagnifyingGlassIcon />
              <Input
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                placeholder="ابحث في الصور…"
              />
            </div>
            <div className="grid max-h-[55dvh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              {assets.data?.items.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="overflow-hidden rounded-xl border text-start focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => onPickExisting(asset.path)}
                >
                  <img
                    src={asset.path}
                    alt={asset.originalFilename}
                    className={cn(
                      artworkAspectRatio(artworkRole),
                      "w-full object-contain bg-muted",
                    )}
                  />
                  <span className="flex items-center justify-between gap-2 p-2 text-xs">
                    <span className="truncate">{asset.originalFilename}</span>
                    <Badge variant="outline">{asset.usageCount}</Badge>
                  </span>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="external" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MagnifyingGlassIcon />
              <Input
                value={externalQuery}
                onChange={(event) => setExternalQuery(event.target.value)}
                placeholder="اسم العمل بالإنجليزية…"
                dir="ltr"
              />
            </div>
            {externalResults.isFetching ? (
              <p className="text-xs text-muted-foreground">جارٍ البحث…</p>
            ) : externalResults.data && externalResults.data.candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                لا توجد نتائج مطابقة. جرّب تعديل اسم البحث.
              </p>
            ) : null}
            <div className="grid max-h-[55dvh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              {externalResults.data?.candidates.map((item) => {
                const style = artworkProviderStyle[item.provider];
                return (
                  <button
                    key={`${item.provider}:${item.externalId}:${item.downloadUrl}`}
                    type="button"
                    className="overflow-hidden rounded-xl border text-start focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => onPickExternal(item)}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.matchLabel}
                      className={cn(
                        artworkAspectRatio(artworkRole),
                        "w-full object-contain bg-muted",
                      )}
                    />
                    <span className="flex items-center justify-between gap-2 p-2 text-xs">
                      <span className="truncate">{item.matchLabel}</span>
                      <Badge variant="outline" className={style.className}>
                        {style.label}
                      </Badge>
                    </span>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Downloads and registers a picked-but-not-yet-fetched external candidate, run only when the
 * caller actually commits it (never while just browsing the picker). */
async function ingestPendingArtwork(
  ingest: ReturnType<
    typeof useMutation<
      { relativePath: string; mimeType: string },
      Error,
      Parameters<typeof ingestArtwork>[0]
    >
  >,
  item: ArtworkCandidate,
  input: {
    role: "poster" | "banner" | "logo";
    ownerName: string;
    titleId?: string;
    installmentId?: string;
  },
) {
  const data: Parameters<typeof ingestArtwork>[0]["data"] = {
    downloadUrl: item.downloadUrl,
    role: input.role,
    ownerName: input.ownerName,
    provider: item.provider,
    externalId: item.externalId,
  };
  if (input.titleId) data.titleId = input.titleId;
  if (input.installmentId) data.installmentId = input.installmentId;
  return ingest.mutateAsync({ data });
}

function ArtworkField({
  label,
  assetType,
  ownerName,
  year,
  kind,
  titleId,
  value,
  onChange,
}: {
  label: string;
  assetType: "poster" | "banner" | "logo";
  ownerName: string;
  year?: number | null;
  kind?: "anime" | "movie";
  titleId?: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const [pendingExternal, setPendingExternal] = useState<ArtworkCandidate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fileInputId = useId();
  const upload = useMutation({ mutationFn: uploadWorkImage });
  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (reader.result !== null && !(reader.result instanceof ArrayBuffer)) {
        upload.mutate(
          { data: { dataUrl: reader.result, fileName: file.name, assetType, ownerName } },
          {
            onSuccess: ({ relativePath }) => {
              setCandidate(relativePath);
              setPendingExternal(null);
            },
          },
        );
      }
    });
    reader.readAsDataURL(file);
  };

  const ingest = useMutation({ mutationFn: ingestArtwork });
  const commit = async () => {
    if (pendingExternal) {
      const stored = await ingestPendingArtwork(ingest, pendingExternal, {
        role: assetType,
        ownerName,
        titleId,
      });
      onChange(stored.relativePath);
    } else {
      onChange(candidate);
    }
    setCandidate("");
    setPendingExternal(null);
  };

  const preview = candidate || value;
  const aspectRatio = artworkAspectRatio(assetType);

  return (
    <Field label={label}>
      <Card size="sm" className="min-w-0 gap-3 overflow-hidden bg-muted/20 py-4 shadow-none">
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
          <div className="grid min-w-0 grid-cols-2 gap-3">
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
            onChange={(event) => {
              setCandidate(event.target.value);
              setPendingExternal(null);
            }}
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
          {ingest.error ? <p className="text-xs text-destructive">{ingest.error.message}</p> : null}
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
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              <GlobeIcon data-icon="inline-start" /> صورة موجودة أو بحث خارجي
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!candidate || ingest.isPending}
              onClick={commit}
            >
              <CheckIcon data-icon="inline-start" />
              {ingest.isPending ? "جارٍ التنزيل…" : "اعتماد"}
            </Button>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                <TrashIcon data-icon="inline-start" /> إزالة
              </Button>
            ) : null}
          </div>
          <ArtworkPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            artworkRole={assetType}
            ownerName={ownerName}
            year={year}
            kind={kind}
            onPickExisting={(path) => {
              setCandidate(path);
              setPendingExternal(null);
              setPickerOpen(false);
            }}
            onPickExternal={(item) => {
              setCandidate(item.previewUrl);
              setPendingExternal(item);
              setPickerOpen(false);
            }}
          />
        </CardFooter>
      </Card>
    </Field>
  );
}

/** A single typed catalog identifier field (TMDB/IMDb/TVDB/AniList/MAL) — `numeric` controls
 * whether the raw input parses as an integer (every provider but IMDb, whose id is `ttNNNNNNN`)
 * or is kept as a trimmed string. `openUrl`, when the field has a value, renders an "open on
 * site" link so an admin can sanity-check the id without leaving the form. */
function IdField<T extends number | string>({
  label,
  value,
  onChange,
  numeric = true,
  placeholder,
  openUrl,
}: {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  numeric?: boolean;
  placeholder?: string;
  openUrl?: (value: string) => string;
}) {
  return (
    <Field label={`معرّف ${label}`}>
      <div className="flex items-center gap-2">
        <Input
          value={value ?? ""}
          placeholder={placeholder}
          inputMode={numeric ? "numeric" : "text"}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) return onChange(null);
            // SAFETY: `numeric` and `T` are set together by every caller below (`numeric` only
            // goes `false` for the IMDb field, whose `value`/`onChange` are typed `string`) — the
            // branch taken here always matches the caller's `T`.
            onChange((numeric ? (Number.isFinite(Number(raw)) ? Number(raw) : null) : raw) as T);
          }}
        />
        {value != null && openUrl && (
          <a
            href={openUrl(String(value))}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground"
          >
            فتح
          </a>
        )}
      </div>
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
        <EditStructureLink workId={structure.workId} />
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
        <EditStructureLink workId={structure.workId} />
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

/** A single installment's own catalog identifiers — a movie's IMDb id lives here, not on the
 * title (see the player/torrent roadmap's Phase 0). */
type SeasonIdPatch = {
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  anilistId?: number | null;
  malId?: number | null;
};

function SeasonArtworkManager({
  structure,
  workTitle,
  year,
  kind,
}: {
  structure: WorkStructure;
  workTitle: string;
  year?: number | null;
  kind?: "anime" | "movie";
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: saveWorkStructure,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-structure", structure.workId] });
    },
  });
  const savePoster = (seasonId: string, posterPath: string | null) =>
    saveSeasonPatch(seasonId, { posterPath });
  const saveIdentifiers = (seasonId: string, ids: SeasonIdPatch) => saveSeasonPatch(seasonId, ids);
  const saveSeasonPatch = (
    seasonId: string,
    patch: SeasonIdPatch & { posterPath?: string | null },
  ) => {
    const editable = parseEditableStructure(
      JSON.stringify(editableStructure(structure)),
      structure.workId,
    );
    mutation.mutate({
      data: {
        workId: editable.workId,
        ungroupedUnits: editable.ungroupedUnits,
        seasons: editable.seasons.map((season) =>
          season.id === seasonId ? { ...season, ...patch } : season,
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
            year={year}
            kind={kind}
            disabled={mutation.isPending}
            onSave={(posterPath) => savePoster(season.id, posterPath)}
            onSaveIdentifiers={(ids) => saveIdentifiers(season.id, ids)}
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
  year,
  kind,
  disabled,
  onSave,
  onSaveIdentifiers,
}: {
  season: WorkStructure["seasons"][number];
  workTitle: string;
  year?: number | null;
  kind?: "anime" | "movie";
  disabled: boolean;
  onSave: (posterPath: string | null) => void;
  onSaveIdentifiers: (ids: SeasonIdPatch) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const [pendingExternal, setPendingExternal] = useState<ArtworkCandidate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ids, setIds] = useState<SeasonIdPatch>({
    tmdbId: season.tmdbId ?? null,
    imdbId: season.imdbId ?? null,
    tvdbId: season.tvdbId ?? null,
    anilistId: season.anilistId ?? null,
    malId: season.malId ?? null,
  });
  const idsChanged =
    ids.tmdbId !== (season.tmdbId ?? null) ||
    ids.imdbId !== (season.imdbId ?? null) ||
    ids.tvdbId !== (season.tvdbId ?? null) ||
    ids.anilistId !== (season.anilistId ?? null) ||
    ids.malId !== (season.malId ?? null);
  const ownerName = `${workTitle} ${season.installmentKind} ${season.position + 1}`;
  const fileInputId = useId();
  const upload = useMutation({ mutationFn: uploadWorkImage });
  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (reader.result !== null && !(reader.result instanceof ArrayBuffer)) {
        upload.mutate(
          { data: { dataUrl: reader.result, fileName: file.name, assetType: "poster", ownerName } },
          {
            onSuccess: ({ relativePath }) => {
              setCandidate(relativePath);
              setPendingExternal(null);
            },
          },
        );
      }
    });
    reader.readAsDataURL(file);
  };

  const ingest = useMutation({ mutationFn: ingestArtwork });
  const save = async () => {
    if (pendingExternal) {
      // `installmentId`, not `titleId`: this poster search matched a season/installment, and its
      // TMDB/AniList id belongs on that installment, not on the umbrella title (see the
      // player/torrent roadmap's Phase 0 — this used to record a season's match at the title
      // level).
      const stored = await ingestPendingArtwork(ingest, pendingExternal, {
        role: "poster",
        ownerName,
        installmentId: season.id,
      });
      onSave(stored.relativePath);
    } else {
      onSave(candidate);
    }
    setCandidate("");
    setPendingExternal(null);
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
          onChange={(event) => {
            setCandidate(event.target.value);
            setPendingExternal(null);
          }}
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
        {ingest.error ? <p className="text-xs text-destructive">{ingest.error.message}</p> : null}
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
            variant="outline"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            <GlobeIcon data-icon="inline-start" /> صورة موجودة أو بحث خارجي
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !candidate || ingest.isPending}
            onClick={save}
          >
            <CheckIcon data-icon="inline-start" />
            {ingest.isPending ? "جارٍ التنزيل…" : "حفظ الملصق"}
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
        <ArtworkPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          artworkRole="poster"
          ownerName={ownerName}
          year={year}
          kind={kind}
          onPickExisting={(path) => {
            setCandidate(path);
            setPendingExternal(null);
            setPickerOpen(false);
          }}
          onPickExternal={(item) => {
            setCandidate(item.previewUrl);
            setPendingExternal(item);
            setPickerOpen(false);
          }}
        />
      </CardFooter>
      <CardFooter className="flex-col items-stretch gap-2 border-t px-4 pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          معرّفات هذا الجزء — معرّف IMDb هو ما يحتاجه التشغيل لاحقاً
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="TMDB"
            dir="ltr"
            className="text-xs"
            disabled={disabled}
            value={ids.tmdbId ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setIds({ ...ids, tmdbId: raw && Number.isFinite(Number(raw)) ? Number(raw) : null });
            }}
          />
          <Input
            placeholder="IMDb (tt…)"
            dir="ltr"
            className="text-xs"
            disabled={disabled}
            value={ids.imdbId ?? ""}
            onChange={(e) => setIds({ ...ids, imdbId: e.target.value.trim() || null })}
          />
          <Input
            placeholder="TVDB"
            dir="ltr"
            className="text-xs"
            disabled={disabled}
            value={ids.tvdbId ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setIds({ ...ids, tvdbId: raw && Number.isFinite(Number(raw)) ? Number(raw) : null });
            }}
          />
          <Input
            placeholder="AniList"
            dir="ltr"
            className="text-xs"
            disabled={disabled}
            value={ids.anilistId ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setIds({
                ...ids,
                anilistId: raw && Number.isFinite(Number(raw)) ? Number(raw) : null,
              });
            }}
          />
          <Input
            placeholder="MyAnimeList"
            dir="ltr"
            className="col-span-2 text-xs"
            disabled={disabled}
            value={ids.malId ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setIds({ ...ids, malId: raw && Number.isFinite(Number(raw)) ? Number(raw) : null });
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !idsChanged}
          onClick={() => onSaveIdentifiers(ids)}
        >
          <CheckIcon data-icon="inline-start" /> حفظ المعرّفات
        </Button>
      </CardFooter>
    </Card>
  );
}

function structureDate(timestamp: number | null) {
  return timestamp === null ? null : new Date(timestamp).toISOString().slice(0, 10);
}

// Parses a raw (untrusted, pasted-JSON) date-ish value into an epoch timestamp. Built as a Zod
// transform — rather than a hand-written function taking an `unknown` value and branching on
// `typeof` — so the actual boundary parsing goes through the schema, and the small helper below
// only ever receives an already-parsed `ZodSafeParseResult`.
const structureDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      ctx.addIssue({ code: "custom", message: "يجب أن يكون بالتنسيق YYYY-MM-DD أو null." });
      return z.NEVER;
    }
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
      ctx.addIssue({ code: "custom", message: "ليس تاريخاً صحيحاً." });
      return z.NEVER;
    }
    return timestamp;
  });

function resolveStructureDate(
  result: z.ZodSafeParseResult<number | null>,
  path: string,
): number | null {
  if (result.success) return result.data;
  throw new Error(`${path} ${result.error.issues[0]?.message ?? "غير صالح."}`);
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
      tmdbId: installment.tmdbId ?? null,
      imdbId: installment.imdbId ?? null,
      tvdbId: installment.tvdbId ?? null,
      anilistId: installment.anilistId ?? null,
      malId: installment.malId ?? null,
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

// Named field shape for a raw (untrusted, pasted-JSON) installment record — every field is
// `unknown` because we haven't validated it yet, but the fields themselves are the real,
// documented contract (unlike an open `Record<string, unknown>` dictionary), and every value
// coming out of this shape is still independently validated below, ultimately by
// `editableWorkStructureSchema.parse` itself.
interface RawStructureInstallment {
  id?: unknown;
  title?: unknown;
  kind?: unknown;
  summary?: unknown;
  status?: unknown;
  posterPath?: unknown;
  score?: unknown;
  position?: unknown;
  releaseDate?: unknown;
  runtimeMinutes?: unknown;
  tmdbId?: unknown;
  imdbId?: unknown;
  tvdbId?: unknown;
  anilistId?: unknown;
  malId?: unknown;
  episodes?: unknown;
}

interface RawStructureDocument {
  schemaVersion?: unknown;
  installments?: RawStructureInstallment[];
}

const rawStructureEpisodeSchema = z.record(z.string(), z.unknown());

function parseEditableStructure(raw: string, workId: string): EditableWorkStructure {
  // SAFETY: `document` is only read through optional, individually-`unknown`-typed fields from
  // here on — nothing below trusts this shape beyond "maybe has these properties" — and the
  // `schemaVersion`/`installments` presence check right after, the per-episode schema check
  // further down, and the final `editableWorkStructureSchema.parse` call all independently
  // validate every value pulled off of it before it's used for anything but re-validation.
  const document = JSON.parse(raw) as RawStructureDocument;
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
        tmdbId: installment.tmdbId ?? null,
        imdbId: installment.imdbId ?? null,
        tvdbId: installment.tvdbId ?? null,
        anilistId: installment.anilistId ?? null,
        malId: installment.malId ?? null,
        unitCount: episodes.length,
        releaseAt: resolveStructureDate(
          structureDateSchema.safeParse(installment.releaseDate),
          `installments.${installmentIndex}.releaseDate`,
        ),
        units: episodes.map((episode, episodeIndex) => {
          const parsedEpisode = rawStructureEpisodeSchema.safeParse(episode);
          if (!parsedEpisode.success) {
            throw new Error(`installments.${installmentIndex}.episodes.${episodeIndex} غير صالح.`);
          }
          const value = parsedEpisode.data;
          return {
            id: value.id,
            unitType: "episode",
            title: value.title ?? null,
            unitNumber: value.number ?? null,
            position: value.position,
            runtimeMinutes: value.runtimeMinutes ?? null,
            releaseAt: resolveStructureDate(
              structureDateSchema.safeParse(value.releaseDate),
              `installments.${installmentIndex}.episodes.${episodeIndex}.releaseDate`,
            ),
          };
        }),
      };
    }),
    ungroupedUnits: [],
  });
}

/**
 * Creating/removing installments and episodes is JSON-only by design (Stage 5) — this links to
 * the unified JSON editor page pre-scoped to this one title with the "structure" preset, instead
 * of the old dialog's own separate, subtly different JSON envelope.
 */
function EditStructureLink({ workId }: { workId: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      nativeButton={false}
      render={
        <Link
          to="/admin/catalog/json"
          search={{ ids: [workId], scope: "ids", preset: "structure" }}
        />
      }
    >
      <CodeIcon data-icon="inline-start" />
      تعديل البنية
    </Button>
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
        "flex min-w-0 max-w-full flex-col gap-5 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 border-b border-border/60 pb-4">
        <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>

      <div
        className={cn(
          subClassname,
          "grid min-w-0 grid-cols-1 items-start gap-5 *:min-w-0 sm:grid-cols-2",
        )}
      >
        {children}
      </div>
    </section>
  );
}
