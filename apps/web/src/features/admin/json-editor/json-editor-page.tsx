"use client";

import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  BracketsCurlyIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardTextIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  ShieldWarningIcon,
  SlidersHorizontalIcon,
  TextAlignLeftIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { AdminWorkUpdate, EditableWorkStructure } from "@/features/library/model";
import { cn } from "@/lib/utils";
import {
  getAdminRecordBundles,
  getAdminWorks,
  getAwardOptions,
  saveAdminRecordChanges,
} from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";
import { MutationErrorAlert } from "../components/mutation-error-alert";
import {
  type CompleteRecord,
  type CompleteRecordDocument,
  completeRecordSchema,
  DEFAULT_PRESET,
  diffAwards,
  diffValues,
  formatDiffValue,
  PROJECTION_FIELDS,
  PROJECTION_PRESETS,
  type ProjectionField,
  type ProjectionKey,
  type ProjectionPreset,
  parseProjectedDocument,
  projectDocument,
  selectedTitleFields,
  TITLE_FIELD_MAP,
  toEditableWork,
  valuesEqual,
} from "./engine";
import { buildCopyGuide, fieldDoc, GLOBAL_SAFETY_NOTES } from "./guide";

/** One save-request entry — built up field by field as `mutation` below decides which parts of
 *  a record actually changed. */
type RecordChange = {
  workId: string;
  work?: AdminWorkUpdate;
  structure?: EditableWorkStructure;
  awards?: ReturnType<typeof diffAwards>;
};

/** Copies one property between two `AdminWorkUpdate` values under a single shared key `K` — the
 *  generic parameter is what lets TypeScript verify `target[key] = source[key]` is well-typed
 *  without a cast, even though the loop that calls this iterates over a heterogeneous set of keys. */
function copyWorkField<K extends keyof AdminWorkUpdate>(
  source: AdminWorkUpdate,
  target: AdminWorkUpdate,
  key: K,
): void {
  target[key] = source[key];
}

export function CatalogJsonPage({
  ids,
  scope,
  preset: initialPresetParam,
}: {
  ids: string[];
  scope: "ids" | "all";
  preset: string | undefined;
}) {
  const navigate = useNavigate();
  const { data: works } = useSuspenseQuery({
    queryKey: ["admin-works"],
    queryFn: () => getAdminWorks(),
  });
  const { data: organizations } = useSuspenseQuery({
    queryKey: ["admin", "awards", "options"],
    queryFn: getAwardOptions,
  });
  const sourceIds = scope === "all" ? works.map((work) => work.id) : ids;

  // SAFETY: the `in` check just below establishes that `initialPresetParam` names a real key of
  // `PROJECTION_PRESETS`.
  const initialPreset: keyof typeof PROJECTION_PRESETS =
    initialPresetParam && initialPresetParam in PROJECTION_PRESETS
      ? (initialPresetParam as keyof typeof PROJECTION_PRESETS)
      : DEFAULT_PRESET;

  const [preset, setPreset] = useState<ProjectionPreset>(initialPreset);
  const [selectedFields, setSelectedFields] = useState<ProjectionKey[]>(() => [
    ...PROJECTION_PRESETS[initialPreset].fields,
  ]);
  const [json, setJson] = useState("");
  const [reviewed, setReviewed] = useState<CompleteRecordDocument | null>(null);
  const [reviewSource, setReviewSource] = useState<CompleteRecordDocument | null>(null);
  const [error, setError] = useState("");
  const [draftBase, setDraftBase] = useState<CompleteRecordDocument | null>(null);
  const [dirty, setDirty] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const bundlesQuery = useQuery({
    queryKey: ["admin-record-bundles", sourceIds],
    queryFn: () => getAdminRecordBundles({ data: { workIds: sourceIds } }),
    enabled: sourceIds.length > 0,
  });
  const sourceDocument = useMemo<CompleteRecordDocument | null>(() => {
    if (!bundlesQuery.data) return null;
    return {
      schemaVersion: 1,
      records: bundlesQuery.data.bundles.map((bundle) => ({
        work: toEditableWork(bundle.work),
        structure: bundle.structure,
        awards: bundle.awards,
      })),
    };
  }, [bundlesQuery.data]);

  useEffect(() => {
    if (!sourceDocument || dirty || reviewed) return;
    setDraftBase(sourceDocument);
    setJson(
      JSON.stringify(
        projectDocument(sourceDocument, selectedFields, preset, organizations),
        null,
        2,
      ),
    );
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceDocument, dirty, reviewed, selectedFields, preset, organizations]);

  const changes = useMemo(() => {
    if (!reviewed || !sourceDocument) return [];
    const originals = new Map(sourceDocument.records.map((record) => [record.work.id, record]));
    return reviewed.records.flatMap((record) => {
      const original = originals.get(record.work.id);
      if (!original) return [];
      const workChanged = JSON.stringify(original.work) !== JSON.stringify(record.work);
      const structureChanged =
        JSON.stringify(original.structure) !== JSON.stringify(record.structure);
      const awardsChanged = JSON.stringify(original.awards) !== JSON.stringify(record.awards);
      const fieldDiffs = [
        ...(workChanged ? diffValues(original.work, record.work, "work") : []),
        ...(structureChanged ? diffValues(original.structure, record.structure, "structure") : []),
        ...(awardsChanged ? diffValues(original.awards, record.awards, "awards") : []),
      ];
      return workChanged || structureChanged || awardsChanged
        ? [{ record, workChanged, structureChanged, awardsChanged, fieldDiffs }]
        : [];
    });
  }, [reviewed, sourceDocument]);

  const review = async () => {
    try {
      if (!draftBase || !sourceDocument) {
        setError("لم تُحمّل السجلات المصدرية بعد.");
        return;
      }
      const merged = parseProjectedDocument(json, draftBase, selectedFields, preset, organizations);
      const refreshed = await bundlesQuery.refetch();
      if (!refreshed.data) throw new Error("تعذر تحديث أحدث سجلات قاعدة البيانات.");
      if (refreshed.data.errors.length) {
        throw new Error(
          `تعذر تحميل ${refreshed.data.errors.length} سجل. أصلح السجلات الموضحة أدناه ثم أعد المحاولة.`,
        );
      }
      const latestDocument: CompleteRecordDocument = {
        schemaVersion: 1,
        records: refreshed.data.bundles.map((bundle) => ({
          work: toEditableWork(bundle.work),
          structure: bundle.structure,
          awards: bundle.awards,
        })),
      };
      const latestById = new Map(latestDocument.records.map((record) => [record.work.id, record]));
      for (const record of merged.records) {
        const opening = draftBase.records.find((candidate) => candidate.work.id === record.work.id);
        const latest = latestById.get(record.work.id);
        if (!opening || !latest)
          throw new Error(`${record.work.id}: the source record no longer exists.`);

        const structureSelected = selectedFields.some((field) => field.startsWith("structure."));
        if (structureSelected && !valuesEqual(opening.structure, latest.structure)) {
          if (!valuesEqual(opening.structure, record.structure)) {
            throw new Error(
              `${record.work.id}: structure changed elsewhere while you were editing. Reset the draft and reapply your change.`,
            );
          }
          record.structure = latest.structure;
        }
        if (!structureSelected) record.structure = latest.structure;

        const awardsSelected = selectedFields.includes("awards");
        if (awardsSelected && !valuesEqual(opening.awards, latest.awards)) {
          if (!valuesEqual(opening.awards, record.awards)) {
            throw new Error(
              `${record.work.id}: awards changed elsewhere while you were editing. Reset the draft and reapply your change.`,
            );
          }
          record.awards = latest.awards;
        }
        if (!awardsSelected) record.awards = latest.awards;

        // `record.work` (from `merged`), `latest.work`, and `opening.work` are all
        // `AdminWorkUpdate`-shaped — keyed by model property names like `title`, not by the
        // JSON projection's field names like `canonicalTitle`. `TITLE_FIELD_MAP` translates
        // between the two so the conflict check and merge below compare/copy the right property.
        const titleKeys = selectedTitleFields(selectedFields).map((jsonField) => ({
          field: `title.${jsonField}` as const,
          key: TITLE_FIELD_MAP[jsonField],
        }));
        for (const { field, key } of titleKeys) {
          if (
            !valuesEqual(opening.work[key], latest.work[key]) &&
            !valuesEqual(opening.work[key], record.work[key]) &&
            !valuesEqual(latest.work[key], record.work[key])
          ) {
            throw new Error(
              `${record.work.id}: ${field} changed elsewhere while you were editing. Reset the draft and reapply your change.`,
            );
          }
        }
        const safelyMergedWork: AdminWorkUpdate = { ...latest.work };
        for (const { key } of titleKeys) copyWorkField(record.work, safelyMergedWork, key);
        record.work = safelyMergedWork;
      }
      setError("");
      setReviewSource(latestDocument);
      setReviewed(completeRecordSchema.parse(merged));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح");
    }
  };

  const mutation = useMutation({
    mutationFn: async (
      updates: Array<{
        record: CompleteRecord;
        workChanged: boolean;
        structureChanged: boolean;
        awardsChanged: boolean;
      }>,
    ) => {
      if (!reviewSource) throw new Error("راجع المسودة الحالية قبل الحفظ.");
      const latestResult = await getAdminRecordBundles({ data: { workIds: sourceIds } });
      if (latestResult.errors.length) {
        throw new Error(`تعذر التحقق من ${latestResult.errors.length} سجل قبل الحفظ.`);
      }
      const latestDocument: CompleteRecordDocument = {
        schemaVersion: 1,
        records: latestResult.bundles.map((bundle) => ({
          work: toEditableWork(bundle.work),
          structure: bundle.structure,
          awards: bundle.awards,
        })),
      };
      if (!valuesEqual(latestDocument, reviewSource)) {
        throw new Error("تغيرت قاعدة البيانات بعد المراجعة. عُد إلى المحرر وراجع مجدداً قبل الحفظ.");
      }
      const changePayload = updates.map((update) => {
        const change: RecordChange = { workId: update.record.work.id };
        if (update.workChanged) change.work = update.record.work;
        if (update.structureChanged) change.structure = update.record.structure;
        if (update.awardsChanged) {
          change.awards = diffAwards(
            latestDocument.records.find((r) => r.work.id === update.record.work.id)?.awards ?? [],
            update.record.awards,
          );
        }
        return change;
      });
      const result = await saveAdminRecordChanges({ data: { changes: changePayload } });
      if (result.errors.length) {
        throw new Error(
          result.errors.map(({ workId, message }) => `${workId}: ${message}`).join("\n"),
        );
      }
    },
    onSuccess: async () => {
      setDirty(false);
      navigate({ to: "/admin/catalog" });
    },
  });

  const jsonValid = useMemo(() => {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }, [json]);

  const applyProjection = (nextFields: ProjectionKey[], nextPreset: ProjectionPreset) => {
    try {
      if (!draftBase) return;
      const merged = dirty
        ? parseProjectedDocument(json, draftBase, selectedFields, preset, organizations)
        : draftBase;
      setDraftBase(merged);
      setSelectedFields(nextFields);
      setPreset(nextPreset);
      setJson(
        JSON.stringify(projectDocument(merged, nextFields, nextPreset, organizations), null, 2),
      );
      setDirty(
        Boolean(sourceDocument) && JSON.stringify(merged) !== JSON.stringify(sourceDocument),
      );
      setReviewed(null);
      setError("");
    } catch (caught) {
      setError(
        `${caught instanceof Error ? caught.message : "JSON غير صالح"} أصلح المسودة قبل تغيير عرضها.`,
      );
    }
  };

  const choosePreset = (value: string | null) => {
    if (!value || !(value in PROJECTION_PRESETS)) return;
    // SAFETY: the `in` check on the line above establishes that `value` names a real key of
    // `PROJECTION_PRESETS`.
    const nextPreset = value as keyof typeof PROJECTION_PRESETS;
    applyProjection([...PROJECTION_PRESETS[nextPreset].fields], nextPreset);
  };

  const toggleField = (field: ProjectionKey, checked: boolean) => {
    const nextFields = checked
      ? [...new Set([...selectedFields, field])]
      : selectedFields.filter((candidate) => candidate !== field);
    applyProjection(nextFields, "custom");
  };

  const insertExample = () => {
    if (!selectedFields.length) return;
    // `example` is a preview JSON blob assembled from whichever optional field groups are
    // selected — there's no fixed shape to give it beyond "a JSON object".
    const example: Record<string, unknown> = {};
    example.id = "<a real title id from this scope>";
    const titleFields = selectedFields.filter((field) => field.startsWith("title."));
    if (titleFields.length) {
      example.title = Object.fromEntries(
        titleFields.map((field) => {
          const doc = PROJECTION_FIELDS.find((candidate) => candidate.key === field);
          if (!doc) throw new Error(`Unknown projection field: ${field}`);
          const fieldExample = fieldDoc(doc).example;
          return [field.slice("title.".length), fieldExample ? JSON.parse(fieldExample) : null];
        }),
      );
    }
    if (selectedFields.some((field) => field.startsWith("structure."))) {
      example.structure = {
        installments: ["// omit id to create a new installment — see the docs panel"],
      };
    }
    if (selectedFields.includes("awards")) {
      example.awards = [
        {
          organizationSlug: "example-org",
          categorySlug: "example-category",
          installmentId: null,
          year: new Date().getFullYear(),
          result: "nominee",
          isFeatured: false,
          sourceUrl: null,
          notes: null,
        },
      ];
    }
    setJson(
      JSON.stringify(
        { schemaVersion: 3, projection: { preset, fields: selectedFields }, records: [example] },
        null,
        2,
      ),
    );
    setDirty(true);
    setReviewed(null);
  };

  const resetDraft = () => {
    if (!sourceDocument) return;
    setDraftBase(sourceDocument);
    setJson(
      JSON.stringify(
        projectDocument(sourceDocument, selectedFields, preset, organizations),
        null,
        2,
      ),
    );
    setDirty(false);
    setReviewed(null);
    setError("");
  };

  const formatJson = (compact = false) => {
    try {
      setJson(JSON.stringify(JSON.parse(json), null, compact ? 0 : 2));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح");
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      setError("تعذر نسخ JSON إلى الحافظة.");
    }
  };

  const copySchemaGuide = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyGuide(selectedFields));
    } catch {
      setError("تعذر نسخ دليل المخطط إلى الحافظة.");
    }
  };

  const findNext = () => {
    const textarea = textareaRef.current;
    if (!textarea || !documentSearch) return;
    const start = textarea.selectionEnd;
    const match = json.toLocaleLowerCase().indexOf(documentSearch.toLocaleLowerCase(), start);
    const index =
      match >= 0 ? match : json.toLocaleLowerCase().indexOf(documentSearch.toLocaleLowerCase());
    if (index < 0) {
      setError(`No match for "${documentSearch}".`);
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(index, index + documentSearch.length);
    setError("");
  };

  const visibleChanges = changes.filter(
    (change) =>
      !reviewSearch ||
      change.record.work.id.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase()) ||
      change.record.work.title.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase()) ||
      change.fieldDiffs.some((diff) =>
        diff.path.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase()),
      ),
  );

  const groupedFields = PROJECTION_FIELDS.reduce<Record<string, ProjectionField[]>>(
    (groups, field) => {
      const group = groups[field.group] ?? [];
      groups[field.group] = group;
      group.push(field);
      return groups;
    },
    {},
  );

  const selectedFieldDocs = PROJECTION_FIELDS.filter((field) =>
    selectedFields.includes(field.key),
  ).map(fieldDoc);

  if (!sourceIds.length) {
    return (
      <div className="p-6">
        <Empty className="rounded-3xl border">
          <EmptyHeader>
            <EmptyTitle>لا توجد سجلات لتحريرها</EmptyTitle>
            <EmptyDescription>
              افتح هذه الصفحة من قائمة الأعمال بعد تحديد سجل واحد أو أكثر.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => navigate({ to: "/admin/catalog" })}>العودة إلى الأعمال</Button>
        </Empty>
      </div>
    );
  }

  const status: "invalid" | "dirty" | "clean" = !jsonValid ? "invalid" : dirty ? "dirty" : "clean";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <AdminPageHeader
        title="مساحة تحرير JSON لقاعدة البيانات"
        description={`${sourceIds.length} سجل في هذا النطاق.`}
        actions={
          <StepPills reviewing={Boolean(reviewed)} onBackToEditor={() => setReviewed(null)} />
        }
      />

      {reviewed ? (
        <ReviewWorkspace
          changes={changes}
          visibleChanges={visibleChanges}
          reviewSearch={reviewSearch}
          onReviewSearchChange={setReviewSearch}
        />
      ) : (
        <EditWorkspace
          preset={preset}
          onChoosePreset={choosePreset}
          selectedFields={selectedFields}
          groupedFields={groupedFields}
          fieldSearch={fieldSearch}
          onFieldSearchChange={setFieldSearch}
          onToggleField={toggleField}
          onSelectAll={() =>
            applyProjection(
              PROJECTION_FIELDS.map((f) => f.key),
              "complete",
            )
          }
          onClearAll={() => applyProjection([], "custom")}
          onCopySchemaGuide={copySchemaGuide}
          onInsertExample={insertExample}
          status={status}
          recordCount={sourceIds.length}
          charCount={json.length}
          documentSearch={documentSearch}
          onDocumentSearchChange={setDocumentSearch}
          onFindNext={findNext}
          onFormat={() => formatJson(false)}
          onCompact={() => formatJson(true)}
          onCopyJson={copyJson}
          onResetDraft={resetDraft}
          dirty={dirty}
          isLoading={bundlesQuery.isPending}
          json={json}
          textareaRef={textareaRef}
          onJsonChange={(value) => {
            setJson(value);
            setDirty(true);
            setReviewed(null);
          }}
          onReview={review}
          onChoosePresetDefault={() => choosePreset(DEFAULT_PRESET)}
          selectedFieldDocs={selectedFieldDocs}
        />
      )}

      {(error || mutation.error || bundlesQuery.error || bundlesQuery.data?.errors.length) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2">
          {error || bundlesQuery.error?.message ? (
            <Alert variant="destructive" className="border-0 bg-transparent">
              <AlertDescription>{error || bundlesQuery.error?.message}</AlertDescription>
            </Alert>
          ) : mutation.error ? (
            <MutationErrorAlert error={mutation.error} />
          ) : (
            <Alert variant="destructive" className="border-0 bg-transparent">
              <AlertDescription>
                <span className="flex flex-col gap-1">
                  <strong>
                    تعذر تحميل {bundlesQuery.data?.errors.length} سجل. أصلح هذه السجلات أو أخرجها من
                    النطاق ثم أعد المحاولة:
                  </strong>
                  {bundlesQuery.data?.errors.slice(0, 6).map((item) => (
                    <code key={item.workId}>
                      {item.workId}: {item.message}
                    </code>
                  ))}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        {reviewed ? (
          <>
            <Button
              variant="outline"
              onClick={() => setReviewed(null)}
              disabled={mutation.isPending}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              العودة إلى المحرر
            </Button>
            <Button
              onClick={() => mutation.mutate(changes)}
              disabled={!changes.length || mutation.isPending}
            >
              {mutation.isPending ? "جارٍ الحفظ…" : `حفظ ${changes.length} سجل`}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => navigate({ to: "/admin/catalog" })}>
              إلغاء
            </Button>
            <Button
              onClick={review}
              disabled={
                !sourceDocument ||
                bundlesQuery.isPending ||
                Boolean(bundlesQuery.data?.errors.length)
              }
            >
              مراجعة التغييرات
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** The page's one signature device: a small two-step chip that reads like a code editor's tab
 *  strip rather than a generic wizard — "المحرر" is always reachable, "المراجعة" only lights up
 *  once a review actually exists. */
function StepPills({
  reviewing,
  onBackToEditor,
}: {
  reviewing: boolean;
  onBackToEditor: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border bg-muted/40 p-1 font-mono text-[11px]"
      dir="ltr"
    >
      <button
        type="button"
        onClick={onBackToEditor}
        aria-current={!reviewing}
        className={cn(
          "rounded-full px-3 py-1 transition-colors",
          !reviewing ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
      >
        1 · editor
      </button>
      <span
        aria-current={reviewing}
        className={cn(
          "rounded-full px-3 py-1 transition-colors",
          reviewing ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/50",
        )}
      >
        2 · review
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: "invalid" | "dirty" | "clean" }) {
  if (status === "invalid") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive">
        <WarningCircleIcon className="size-3.5" weight="fill" />
        JSON غير صالح
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-classification-caution/30 bg-classification-caution/10 px-2.5 py-1 text-[11px] font-medium text-classification-caution">
        <span className="size-1.5 rounded-full bg-classification-caution" />
        مسودة غير محفوظة
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-classification-safe/30 bg-classification-safe/10 px-2.5 py-1 text-[11px] font-medium text-classification-safe">
      <CheckCircleIcon className="size-3.5" weight="fill" />
      JSON صالح
    </span>
  );
}

function EditWorkspace({
  preset,
  onChoosePreset,
  selectedFields,
  groupedFields,
  fieldSearch,
  onFieldSearchChange,
  onToggleField,
  onSelectAll,
  onClearAll,
  onCopySchemaGuide,
  onInsertExample,
  status,
  recordCount,
  charCount,
  documentSearch,
  onDocumentSearchChange,
  onFindNext,
  onFormat,
  onCompact,
  onCopyJson,
  onResetDraft,
  dirty,
  isLoading,
  json,
  textareaRef,
  onJsonChange,
  onReview,
  onChoosePresetDefault,
  selectedFieldDocs,
}: {
  preset: ProjectionPreset;
  onChoosePreset: (value: string | null) => void;
  selectedFields: ProjectionKey[];
  groupedFields: Record<string, ProjectionField[]>;
  fieldSearch: string;
  onFieldSearchChange: (value: string) => void;
  onToggleField: (field: ProjectionKey, checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onCopySchemaGuide: () => void;
  onInsertExample: () => void;
  status: "invalid" | "dirty" | "clean";
  recordCount: number;
  charCount: number;
  documentSearch: string;
  onDocumentSearchChange: (value: string) => void;
  onFindNext: () => void;
  onFormat: () => void;
  onCompact: () => void;
  onCopyJson: () => void;
  onResetDraft: () => void;
  dirty: boolean;
  isLoading: boolean;
  json: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onJsonChange: (value: string) => void;
  onReview: () => void;
  onChoosePresetDefault: () => void;
  selectedFieldDocs: ReturnType<typeof fieldDoc>[];
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
      <Card className="flex min-h-0 flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-2 border-b p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <SlidersHorizontalIcon className="size-3.5" />
            قالب التحرير
          </p>
          <Select
            items={Object.entries(PROJECTION_PRESETS).map(([value, definition]) => ({
              value,
              label: definition.label,
            }))}
            value={preset}
            onValueChange={onChoosePreset}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(PROJECTION_PRESETS).map(([value, definition]) => (
                  <SelectItem key={value} value={value}>
                    {definition.label}
                  </SelectItem>
                ))}
                {preset === "custom" && <SelectItem value="custom">اختيار مخصص</SelectItem>}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 border-b p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              الحقول · <span className="font-mono">{selectedFields.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="xs" onClick={onSelectAll}>
                الكل
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!selectedFields.length}
                onClick={onClearAll}
              >
                لا شيء
              </Button>
            </div>
          </div>
          <Input
            value={fieldSearch}
            onChange={(event) => onFieldSearchChange(event.target.value)}
            placeholder="ابحث عن الحقول…"
            className="h-8 text-xs"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
          <p className="text-[11px] text-muted-foreground">
            يُضمّن معرّف العمل دائماً ولا يمكن تغييره.
          </p>
          {Object.entries(groupedFields).map(([group, fields]) => {
            const matchingFields = fields.filter((field) =>
              `${field.label} ${field.key}`
                .toLocaleLowerCase()
                .includes(fieldSearch.toLocaleLowerCase()),
            );
            if (!matchingFields.length) return null;
            return (
              <section key={group} className="flex flex-col gap-1">
                <strong className="px-1 text-[11px] font-semibold text-muted-foreground uppercase">
                  {group}
                </strong>
                {matchingFields.map((field) => {
                  const checked = selectedFields.includes(field.key);
                  return (
                    <label
                      key={field.key}
                      htmlFor={`projection-${field.key}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted",
                        checked && "bg-primary/5",
                      )}
                    >
                      <Checkbox
                        id={`projection-${field.key}`}
                        checked={checked}
                        onCheckedChange={(value) => onToggleField(field.key, value === true)}
                      />
                      <span className="min-w-0 flex-1 text-xs">
                        {field.label}
                        <code className="block truncate text-[10px] text-muted-foreground">
                          {field.key}
                        </code>
                      </span>
                    </label>
                  );
                })}
              </section>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t p-3">
          <Button type="button" variant="outline" size="sm" onClick={onCopySchemaGuide}>
            <ClipboardTextIcon data-icon="inline-start" />
            نسخ دليل المخطط
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onInsertExample}
            disabled={!selectedFields.length}
          >
            <MagicWandIcon data-icon="inline-start" />
            أدرج مثالاً
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-0 flex-col gap-0 overflow-hidden p-0">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
          <StatusChip status={status} />
          <span className="font-mono text-[10px] text-muted-foreground">
            {recordCount} سجل · {selectedFields.length} حقل · {charCount.toLocaleString()} حرف
          </span>
          <div className="ms-auto flex min-w-64 items-center gap-1">
            <Input
              value={documentSearch}
              onChange={(event) => onDocumentSearchChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onFindNext()}
              placeholder="ابحث في JSON…"
              className="h-7 text-xs"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onFindNext}
              aria-label="البحث عن التالي"
            >
              <MagnifyingGlassIcon />
            </Button>
            <Separator orientation="vertical" className="mx-0.5 h-4" />
            <Button variant="ghost" size="icon-xs" onClick={onFormat} aria-label="تنسيق JSON">
              <TextAlignLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onCompact} aria-label="ضغط JSON">
              <BracketsCurlyIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onCopyJson} aria-label="نسخ JSON">
              <ClipboardTextIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onResetDraft}
              disabled={!dirty}
              aria-label="إعادة ضبط المسودة"
            >
              <ArrowsClockwiseIcon />
            </Button>
          </div>
        </div>
        {isLoading ? (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            جارٍ تحميل السجلات المنظمة…
          </div>
        ) : !selectedFields.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <strong>اختر الحقول لبدء التحرير</strong>
            <p className="max-w-sm text-sm text-muted-foreground">
              لا يعرض هذا المحرر شيئاً حتى تختار قالباً أو حقولاً من الشريط الجانبي — لا يوجد نص فارغ
              بلا توجيه.
            </p>
            <Button type="button" variant="outline" onClick={onChoosePresetDefault}>
              استخدم "السجل الكامل القابل للتعديل"
            </Button>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={json}
            onChange={(event) => onJsonChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onReview();
              } else if (event.key === "Tab") {
                event.preventDefault();
                const target = event.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const next = `${json.slice(0, start)}  ${json.slice(end)}`;
                onJsonChange(next);
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = start + 2;
                });
              }
            }}
            spellCheck={false}
            dir="ltr"
            aria-label="JSON للسجلات المعروضة"
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-4 text-left font-mono text-xs leading-5 outline-none [unicode-bidi:plaintext]"
          />
        )}
      </Card>

      <Card className="flex min-h-0 flex-col gap-0 overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-muted-foreground">دليل الحقول المحدّدة</p>
          {selectedFieldDocs.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد حقول محدّدة بعد.</p>
          ) : (
            selectedFieldDocs.map((doc) => (
              <div key={doc.key} className="rounded-lg border bg-background p-3 text-xs">
                <code className="block text-[10px] text-muted-foreground">{doc.key}</code>
                <strong className="block">{doc.label}</strong>
                <p className="mt-1 text-muted-foreground">{doc.purpose}</p>
                <p className="mt-1 font-mono text-[10px]">
                  {doc["shape"]} · {doc.required ? "required key" : "optional key"} ·{" "}
                  {doc.nullable ? "nullable" : "not nullable"}
                </p>
                {doc.safetyNotes ? (
                  <p className="mt-1 text-classification-caution">⚠ {doc.safetyNotes}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
        <div className="flex flex-col gap-2 border-t bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <ShieldWarningIcon className="size-3.5" />
            ملاحظات السلامة
          </p>
          <ul className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
            {GLOBAL_SAFETY_NOTES.map((note) => (
              <li key={note} className="flex gap-1.5">
                <span aria-hidden="true">·</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function ReviewWorkspace({
  changes,
  visibleChanges,
  reviewSearch,
  onReviewSearchChange,
}: {
  changes: Array<{
    record: CompleteRecord;
    workChanged: boolean;
    structureChanged: boolean;
    awardsChanged: boolean;
    fieldDiffs: ReturnType<typeof diffValues>;
  }>;
  visibleChanges: Array<{
    record: CompleteRecord;
    workChanged: boolean;
    structureChanged: boolean;
    awardsChanged: boolean;
    fieldDiffs: ReturnType<typeof diffValues>;
  }>;
  reviewSearch: string;
  onReviewSearchChange: (value: string) => void;
}) {
  return (
    <Card className="min-h-0 flex-1 gap-0 overflow-y-auto p-5">
      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
        <div>
          <strong className="block text-sm">تغيّر {changes.length} سجل</strong>
          <span className="text-xs text-muted-foreground">
            {changes.reduce((total, change) => total + change.fieldDiffs.length, 0)} تغييراً دقيقاً في
            الحقول جاهزاً للحفظ.
          </span>
        </div>
        <Badge>{changes.length} معلّق</Badge>
      </div>
      {changes.length ? (
        <div className="flex flex-col gap-4">
          <Input
            value={reviewSearch}
            onChange={(event) => onReviewSearchChange(event.target.value)}
            placeholder="فلترة حسب العنوان أو المعرّف أو المسار المتغير…"
            aria-label="فلترة التغييرات المراجعة"
          />
          {visibleChanges.map(
            ({ record, workChanged, structureChanged, awardsChanged, fieldDiffs }) => {
              const headingId = `json-review-${record.work.id}`;
              return (
                <section
                  key={record.work.id}
                  aria-labelledby={headingId}
                  className="overflow-hidden rounded-lg border bg-card"
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                    <div>
                      <h3 id={headingId} className="text-sm font-semibold">
                        {record.work.arabicTitle || record.work.title}
                      </h3>
                      <code className="mt-1 block text-[10px] text-muted-foreground">
                        {record.work.id}
                      </code>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Badge variant="outline">{fieldDiffs.length} حقل</Badge>
                      {workChanged && <Badge>بيانات العنوان</Badge>}
                      {structureChanged && <Badge variant="secondary">البنية</Badge>}
                      {awardsChanged && <Badge variant="secondary">الجوائز</Badge>}
                    </div>
                  </header>
                  <dl className="divide-y">
                    {fieldDiffs.map((diff) => {
                      const hasOldValue = diff.kind !== "added";
                      const hasNewValue = diff.kind !== "removed";
                      return (
                        <div
                          key={`${diff.kind}-${diff.path}`}
                          className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start"
                        >
                          <dt className="flex min-w-0 flex-col items-start gap-1.5">
                            <Badge
                              variant={
                                diff.kind === "removed"
                                  ? "destructive"
                                  : diff.kind === "changed"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {diff.kind === "removed"
                                ? "محذوف"
                                : diff.kind === "changed"
                                  ? "متغير"
                                  : "مضاف"}
                            </Badge>
                            <code className="text-[11px] break-all text-muted-foreground">
                              {diff.path}
                            </code>
                          </dt>
                          <dd className="min-w-0 rounded-md border bg-muted/20 p-3">
                            <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                              القيمة القديمة
                            </span>
                            <pre className="font-mono text-xs break-all whitespace-pre-wrap">
                              {formatDiffValue(diff.oldValue, hasOldValue)}
                            </pre>
                          </dd>
                          <span
                            aria-hidden="true"
                            className="hidden pt-7 text-muted-foreground lg:block"
                          >
                            →
                          </span>
                          <span className="sr-only">تغيرت إلى</span>
                          <dd className="min-w-0 rounded-md border bg-muted/20 p-3">
                            <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                              القيمة الجديدة
                            </span>
                            <pre className="font-mono text-xs break-all whitespace-pre-wrap">
                              {formatDiffValue(diff.newValue, hasNewValue)}
                            </pre>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              );
            },
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-lg border border-dashed p-12 text-center">
          <CheckIcon className="mb-3 size-8 text-primary" />
          <strong>لم يُعثر على تغييرات</strong>
        </div>
      )}
    </Card>
  );
}
