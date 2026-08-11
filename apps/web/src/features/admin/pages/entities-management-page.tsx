import {
  BracketsCurlyIcon,
  CheckIcon,
  FloppyDiskIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminEntityInput,
  adminEntityInputSchema,
  type Entity,
} from "@/features/library/model";
import { cn } from "@/lib/utils";
import {
  deleteEntities,
  getEntities,
  saveEntities,
  saveEntity,
  uploadEntityImage,
} from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

type EntityKind = Entity["entityType"];
type Draft = AdminEntityInput;
type EntityDocument = { schemaVersion: 1; entities: AdminEntityInput[] };
type ValueDiff = {
  kind: "added" | "changed" | "removed";
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
};
type EntityReview = {
  source: EntityDocument;
  document: EntityDocument;
  updates: Array<{ entity: AdminEntityInput; diffs: ValueDiff[] }>;
  deleted: Entity[];
};

function createDraft(kind: EntityKind, entity?: Entity): Draft {
  return {
    id: entity?.id,
    name: entity?.name ?? "",
    sortName: entity?.sortName ?? "",
    entityType: kind,
    description: entity?.description ?? "",
    imagePath: entity?.imagePath ?? null,
    primaryUrl: entity?.primaryUrl ?? null,
    malId: entity?.malId ?? null,
    anilistId: entity?.anilistId ?? null,
    imdbId: entity?.imdbId ?? null,
    wikipediaUrl: entity?.wikipediaUrl ?? null,
    establishedAt: entity?.establishedAt ?? null,
    birthDate: entity?.birthDate ?? null,
    deathDate: entity?.deathDate ?? null,
    favorites: entity?.favorites ?? null,
  };
}

function entityInputFromDraft(draft: Draft): AdminEntityInput {
  return draft;
}

function editableEntity(entity: Entity): AdminEntityInput {
  return entityInputFromDraft(createDraft(entity.entityType, entity));
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffEntityValues(left: unknown, right: unknown, path: string): ValueDiff[] {
  if (valuesEqual(left, right)) return [];
  if (
    left !== null &&
    right !== null &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    return [...keys].flatMap((key) => {
      const nextPath = `${path}.${key}`;
      if (!(key in leftRecord))
        return [{ kind: "added", path: nextPath, newValue: rightRecord[key] }];
      if (!(key in rightRecord))
        return [{ kind: "removed", path: nextPath, oldValue: leftRecord[key] }];
      return diffEntityValues(leftRecord[key], rightRecord[key], nextPath);
    });
  }
  return [{ kind: "changed", path, oldValue: left, newValue: right }];
}

function formatValue(value: unknown, present: boolean) {
  return present ? JSON.stringify(value, null, 2) : "غير موجود";
}

export function EntitiesManagementPage({ kind }: { kind: EntityKind }) {
  const queryClient = useQueryClient();
  const { data: allEntities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const entities = useMemo(
    () =>
      allEntities
        .filter((entity) => entity.entityType === kind)
        .sort(
          (left, right) =>
            right.workCount - left.workCount || left.sortName.localeCompare(right.sortName),
        ),
    [allEntities, kind],
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft>(() => createDraft(kind, entities[0]));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [jsonOpen, setJsonOpen] = useState(false);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entities.filter(
      (entity) =>
        !query || [entity.name, entity.sortName].join(" ").toLocaleLowerCase().includes(query),
    );
  }, [entities, search]);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["entities"] });
  const mutation = useMutation({
    mutationFn: saveEntity,
    onSuccess: async (saved) => {
      await refresh();
      setDraft(createDraft(kind, saved));
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ data: entityInputFromDraft(draft) });
  };
  const visibleIds = filtered.map(({ id }) => id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const toggleVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  };
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };
  const label = kind === "person" ? "الأشخاص" : "الاستوديوهات والمنظمات";
  const selectedEntities = entities.filter(({ id }) => selectedIds.has(id));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminPageHeader
        title={`إدارة ${label}`}
        description={
          kind === "person"
            ? "أشخاص منتقون فقط: الهوية والأسماء البديلة والمصادر، من دون استيراد طاقم كامل."
            : "إدارة الاستوديوهات والمنظمات ككيانات مستقلة ذات معرّفات ثابتة."
        }
        actions={
          <Button variant="outline" onClick={() => setDraft(createDraft(kind))}>
            <PlusIcon data-icon="inline-start" /> سجل جديد
          </Button>
        }
      />
      <div className="grid min-w-0 gap-6 px-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <Card className="xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{label}</CardTitle>
                <CardDescription>
                  {filtered.length} من أصل {entities.length}، مرتبة بعدد الأعمال
                </CardDescription>
              </div>
              {selectedIds.size > 0 ? <Badge>{selectedIds.size} محدد</Badge> : null}
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث بالاسم أو الاسم البديل…"
                className="pe-9"
              />
            </div>
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/40 p-2">
                <Button size="sm" onClick={() => setJsonOpen(true)}>
                  <NotePencilIcon data-icon="inline-start" /> محرر JSON
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  مسح التحديد
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-col gap-3">
            <Field orientation="horizontal" className="border-b pb-3">
              <Checkbox
                id={`entities-select-all-${kind}`}
                checked={allVisibleSelected}
                onCheckedChange={(value) => toggleVisible(value === true)}
              />
              <FieldLabel htmlFor={`entities-select-all-${kind}`}>تحديد النتائج الحالية</FieldLabel>
            </Field>
            <div className="flex min-h-0 flex-col gap-1 overflow-y-auto xl:max-h-[calc(100dvh-20rem)]">
              {filtered.map((entity) => {
                const checked = selectedIds.has(entity.id);
                return (
                  <div
                    key={entity.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-transparent p-2 transition-colors hover:bg-muted",
                      draft.id === entity.id && "border-border bg-muted",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleSelected(entity.id, value === true)}
                      aria-label={`تحديد ${entity.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => setDraft(createDraft(kind, entity))}
                      className="min-w-0 flex-1 p-1 text-start"
                    >
                      <strong className="block truncate text-sm">{entity.name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {entity.workCount} عمل مرتبط
                      </span>
                    </button>
                    <Badge variant={entity.workCount ? "secondary" : "outline"}>
                      {entity.workCount}
                    </Badge>
                  </div>
                );
              })}
              {!filtered.length ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>لا توجد نتائج</EmptyTitle>
                    <EmptyDescription>غيّر البحث أو أضف سجلاً جديداً.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <form onSubmit={submit}>
            <CardHeader>
              <CardTitle>{draft.id ? "تحرير السجل" : "إنشاء سجل"}</CardTitle>
              <CardDescription>
                التعديلات الفردية تحفظ هذا السجل فقط. استخدم محرر JSON للتعديل المجمع والمراجعة.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="entity-name">الاسم</FieldLabel>
                    <Input
                      id="entity-name"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          name: event.target.value,
                          ...(!current.id
                            ? { sortName: event.target.value.toLocaleLowerCase() }
                            : {}),
                        }))
                      }
                      required
                      dir="auto"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="entity-sort">اسم الفرز</FieldLabel>
                    <Input
                      id="entity-sort"
                      value={draft.sortName}
                      onChange={(event) => setDraft({ ...draft, sortName: event.target.value })}
                      required
                      dir="auto"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="entity-description">النبذة</FieldLabel>
                  <Textarea
                    id="entity-description"
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    rows={5}
                    dir="auto"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="entity-primary-url">الرابط المرجعي</FieldLabel>
                    <Input
                      id="entity-primary-url"
                      type="url"
                      value={draft.primaryUrl ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, primaryUrl: event.target.value || null })
                      }
                      placeholder={
                        kind === "person"
                          ? "AniList أو الموقع الرسمي"
                          : "MAL أو IMDb أو الموقع الرسمي"
                      }
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="entity-wikipedia">رابط ويكيبيديا</FieldLabel>
                    <Input
                      id="entity-wikipedia"
                      type="url"
                      value={draft.wikipediaUrl ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, wikipediaUrl: event.target.value || null })
                      }
                      placeholder="https://…"
                      dir="ltr"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="entity-mal">MAL ID</FieldLabel>
                    <Input
                      id="entity-mal"
                      type="number"
                      min="1"
                      value={draft.malId ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          malId: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="entity-anilist">AniList ID</FieldLabel>
                    <Input
                      id="entity-anilist"
                      type="number"
                      min="1"
                      value={draft.anilistId ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          anilistId: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="entity-imdb">IMDb ID</FieldLabel>
                    <Input
                      id="entity-imdb"
                      value={draft.imdbId ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, imdbId: event.target.value || null })
                      }
                      placeholder="nm0000000 / co0000000"
                      dir="ltr"
                    />
                  </Field>
                </div>
                {kind === "organization" ? (
                  <Field>
                    <FieldLabel htmlFor="entity-established">تاريخ التأسيس</FieldLabel>
                    <Input
                      id="entity-established"
                      type="date"
                      value={draft.establishedAt ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, establishedAt: event.target.value || null })
                      }
                      dir="ltr"
                    />
                  </Field>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="entity-birth-date">تاريخ الميلاد</FieldLabel>
                      <Input
                        id="entity-birth-date"
                        type="date"
                        value={draft.birthDate ?? ""}
                        onChange={(event) =>
                          setDraft({ ...draft, birthDate: event.target.value || null })
                        }
                        dir="ltr"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="entity-death-date">تاريخ الوفاة</FieldLabel>
                      <Input
                        id="entity-death-date"
                        type="date"
                        value={draft.deathDate ?? ""}
                        onChange={(event) =>
                          setDraft({ ...draft, deathDate: event.target.value || null })
                        }
                        dir="ltr"
                      />
                    </Field>
                  </div>
                )}
                {mutation.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{mutation.error.message}</AlertDescription>
                  </Alert>
                ) : null}
              </FieldGroup>
              <div className="my-6">
                <EntityArtworkField
                  value={draft.imagePath}
                  onChange={(imagePath) => setDraft({ ...draft, imagePath })}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={mutation.isPending}>
                <FloppyDiskIcon data-icon="inline-start" />
                {mutation.isPending ? "جارٍ الحفظ…" : "حفظ السجل"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
      <EntityJsonEditor
        open={jsonOpen}
        onOpenChange={setJsonOpen}
        kind={kind}
        entities={selectedEntities}
        onSaved={async () => {
          setSelectedIds(new Set());
          await refresh();
        }}
      />
    </div>
  );
}

function EntityArtworkField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (imagePath: string | null) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const upload = useMutation({ mutationFn: uploadEntityImage });
  const preview = candidate || value;
  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file?.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      upload.mutate(
        { data: { dataUrl: reader.result, fileName: file.name } },
        { onSuccess: ({ relativePath }) => setCandidate(relativePath) },
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <Field>
      <FieldLabel>الصورة الشخصية</FieldLabel>
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-2 text-xs text-muted-foreground">الصورة الحالية</p>
            <div className="aspect-square overflow-hidden rounded-md border bg-muted">
              {value ? (
                <img
                  src={value}
                  alt="الصورة الحالية"
                  className="size-full object-contain bg-white"
                />
              ) : null}
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-xs text-muted-foreground">المعاينة قبل الحفظ</p>
            <div className="aspect-square overflow-hidden rounded-md border bg-muted">
              {preview ? (
                <img
                  src={preview}
                  alt="معاينة الصورة الجديدة"
                  className="size-full object-contain bg-white"
                />
              ) : null}
            </div>
          </div>
        </div>
        <Input
          value={candidate}
          onChange={(event) => setCandidate(event.target.value)}
          placeholder="ألصق مسار صورة أو ارفع ملفاً"
          dir="ltr"
        />
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={uploadFile}
          disabled={upload.isPending}
        />
        {upload.error ? (
          <Alert variant="destructive">
            <AlertDescription>{upload.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!candidate}
            onClick={() => {
              onChange(candidate);
              setCandidate("");
            }}
          >
            <CheckIcon data-icon="inline-start" /> اعتماد الصورة
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              إزالة الصورة
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

function EntityJsonEditor({
  open,
  onOpenChange,
  kind,
  entities,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: EntityKind;
  entities: Entity[];
  onSaved: () => Promise<void>;
}) {
  const [json, setJson] = useState("");
  const [review, setReview] = useState<EntityReview | null>(null);
  const [error, setError] = useState("");
  const source = useMemo<EntityDocument>(
    () => ({ schemaVersion: 1, entities: entities.map(editableEntity) }),
    [entities],
  );

  useEffect(() => {
    if (open) {
      setJson(JSON.stringify(source, null, 2));
      setReview(null);
      setError("");
    }
  }, [open, source]);

  const parseReview = (): EntityReview => {
    const parsed = JSON.parse(json) as { schemaVersion?: unknown; entities?: unknown };
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.entities)) {
      throw new Error("يجب أن يحتوي المستند على schemaVersion: 1 ومصفوفة entities.");
    }
    const inputs = parsed.entities.map((entity) => adminEntityInputSchema.parse(entity));
    const sourceById = new Map(source.entities.map((entity) => [entity.id, entity]));
    const receivedIds = inputs.map((entity) => entity.id);
    if (
      new Set(receivedIds).size !== receivedIds.length ||
      inputs.some(
        (entity) => !entity.id || !sourceById.has(entity.id) || entity.entityType !== kind,
      )
    ) {
      throw new Error(
        "احتفظ بالمعرّفات الفريدة نفسها ونوع الكيان. يمكنك حذف سجل فقط بإزالته من المصفوفة.",
      );
    }
    const updates = inputs.flatMap((entity) => {
      if (!entity.id) return [];
      const original = sourceById.get(entity.id);
      if (!original) return [];
      const diffs = diffEntityValues(original, entity, "entity");
      return diffs.length ? [{ entity, diffs }] : [];
    });
    const kept = new Set(receivedIds);
    return {
      source,
      document: { schemaVersion: 1, entities: inputs },
      updates,
      deleted: entities.filter((entity) => !kept.has(entity.id)),
    };
  };

  const mutation = useMutation({
    mutationFn: async (nextReview: EntityReview) => {
      const latest = await getEntities();
      const latestById = new Map(latest.map((entity) => [entity.id, editableEntity(entity)]));
      for (const original of nextReview.source.entities) {
        if (!original.id || !valuesEqual(latestById.get(original.id), original)) {
          throw new Error(
            "تغير أحد السجلات بعد المراجعة. عُد إلى التحرير وراجع أحدث البيانات قبل الحفظ.",
          );
        }
      }
      if (nextReview.updates.length)
        await saveEntities({ data: { entities: nextReview.updates.map(({ entity }) => entity) } });
      if (nextReview.deleted.length)
        await deleteEntities({ data: { ids: nextReview.deleted.map(({ id }) => id) } });
    },
    onSuccess: async () => {
      await onSaved();
      onOpenChange(false);
    },
  });

  const openReview = () => {
    try {
      const nextReview = parseReview();
      if (!nextReview.updates.length && !nextReview.deleted.length)
        throw new Error("لم يُعثر على تغييرات لمراجعتها.");
      setReview(nextReview);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        dir="rtl"
        className="flex h-[min(92dvh,56rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none lg:w-[min(72rem,calc(100vw-3rem))]"
      >
        <DialogHeader className="flex shrink-0 flex-col justify-between gap-4 border-b p-5 text-right md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
              <BracketsCurlyIcon />
            </div>
            <div>
              <DialogTitle>مساحة تحرير JSON للكيانات</DialogTitle>
              <DialogDescription>
                الخطوة الأولى تغيّر المسودة فقط. في الخطوة الثانية راجع كل حقل قبل التطبيق؛ إزالة
                كيان من المصفوفة تجهّز حذفه.
              </DialogDescription>
            </div>
          </div>
          <div className="flex gap-1 font-mono text-[10px]">
            <Badge variant={review ? "outline" : "default"}>١ · تعديل</Badge>
            <Badge variant={review ? "default" : "outline"}>٢ · مراجعة</Badge>
          </div>
        </DialogHeader>
        {review ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
              <div>
                <strong className="block text-sm">جاهز لتطبيق التغييرات</strong>
                <span className="text-xs text-muted-foreground">
                  {review.updates.reduce((total, update) => total + update.diffs.length, 0)} تغييراً
                  في الحقول و{review.deleted.length} حذفاً معلقاً.
                </span>
              </div>
              <Badge>{review.updates.length + review.deleted.length} سجل متأثر</Badge>
            </div>
            <div className="flex flex-col gap-4">
              {review.updates.map(({ entity, diffs }) => (
                <section key={entity.id} className="overflow-hidden rounded-lg border bg-card">
                  <header className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold">{entity.name}</h3>
                      <code className="mt-1 block text-[10px] text-muted-foreground">
                        {entity.id}
                      </code>
                    </div>
                    <Badge variant="secondary">{diffs.length} حقل</Badge>
                  </header>
                  <dl className="divide-y">
                    {diffs.map((diff) => (
                      <div
                        key={`${diff.kind}-${diff.path}`}
                        className="grid gap-3 px-4 py-3 lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]"
                      >
                        <dt className="flex flex-col items-start gap-1.5">
                          <Badge
                            variant={
                              diff.kind === "removed"
                                ? "destructive"
                                : diff.kind === "added"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {diff.kind === "removed"
                              ? "محذوف"
                              : diff.kind === "added"
                                ? "مضاف"
                                : "متغير"}
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
                            {formatValue(diff.oldValue, diff.kind !== "added")}
                          </pre>
                        </dd>
                        <dd className="min-w-0 rounded-md border bg-muted/20 p-3">
                          <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                            القيمة الجديدة
                          </span>
                          <pre className="font-mono text-xs break-all whitespace-pre-wrap">
                            {formatValue(diff.newValue, diff.kind !== "removed")}
                          </pre>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              {review.deleted.map((entity) => (
                <Alert key={entity.id} variant="destructive">
                  <TrashIcon />
                  <AlertTitle>سيُحذف {entity.name}</AlertTitle>
                  <AlertDescription>
                    سيُحذف الملف والأسماء البديلة والمعرّفات الخارجية وصورة الملف، وتُزال مساهماته من
                    الأعمال المرتبطة. لا يمكن التراجع عن هذا الإجراء.
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 p-5">
            <Textarea
              value={json}
              onChange={(event) => {
                setJson(event.target.value);
                setError("");
              }}
              className="
h-full resize-none font-mono text-xs leading-6 ltr"
              dir="ltr"
              spellCheck={false}
              aria-label="محتوى JSON للكيانات"
            />
          </div>
        )}
        {error || mutation.error ? (
          <div className="shrink-0 px-5 pb-4">
            <Alert variant="destructive">
              <AlertTitle>تعذر المتابعة</AlertTitle>
              <AlertDescription>{error || mutation.error?.message}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <DialogFooter className="flex shrink-0 flex-row items-center justify-between gap-2 border-t bg-background p-4">
          {review ? (
            <Button
              variant="outline"
              onClick={() => {
                setReview(null);
                setError("");
              }}
              disabled={mutation.isPending}
            >
              العودة إلى التحرير
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          )}
          {review ? (
            <Button
              variant="destructive"
              onClick={() => mutation.mutate(review)}
              disabled={mutation.isPending}
            >
              <CheckIcon data-icon="inline-start" />
              {mutation.isPending ? "جارٍ التطبيق…" : "تطبيق التغييرات"}
            </Button>
          ) : (
            <Button onClick={openReview}>
              <FloppyDiskIcon data-icon="inline-start" />
              مراجعة التغييرات
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
