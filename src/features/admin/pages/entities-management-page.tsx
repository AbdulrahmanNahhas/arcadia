import {
  BracketsCurlyIcon,
  FloppyDiskIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { deleteEntities, getEntities, saveEntities, saveEntity } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

type EntityKind = Entity["entityType"];
type Draft = AdminEntityInput & { aliasesText: string; identitiesText: string };

function createDraft(kind: EntityKind, entity?: Entity): Draft {
  return {
    id: entity?.id,
    name: entity?.name ?? "",
    sortName: entity?.sortName ?? "",
    entityType: kind,
    description: entity?.description ?? "",
    imagePath: entity?.imagePath ?? null,
    malId: entity?.malId ?? null,
    sourceUrl: entity?.sourceUrl ?? null,
    sourceProvider: entity?.sourceProvider ?? null,
    establishedAt: entity?.establishedAt ?? null,
    favorites: entity?.favorites ?? null,
    alternativeNames: entity?.alternativeNames ?? [],
    externalIdentities: entity?.externalIdentities ?? [],
    aliasesText: entity?.alternativeNames.join("\n") ?? "",
    identitiesText:
      entity?.externalIdentities
        .map(({ provider, externalId, url }) => [provider, externalId, url ?? ""].join(" | "))
        .join("\n") ?? "",
  };
}

function entityInputFromDraft(draft: Draft): AdminEntityInput {
  const { aliasesText, identitiesText, ...input } = draft;
  return {
    ...input,
    alternativeNames: aliasesText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
    externalIdentities: identitiesText
      .split("\n")
      .map((line) => line.split("|").map((value) => value.trim()))
      .filter(([provider, externalId]) => Boolean(provider && externalId))
      .map(([provider, externalId, url]) => ({ provider, externalId, url: url || null })),
  };
}

export function EntitiesManagementPage({ kind }: { kind: EntityKind }) {
  const queryClient = useQueryClient();
  const { data: allEntities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const entities = useMemo(
    () => allEntities.filter((entity) => entity.entityType === kind),
    [allEntities, kind],
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft>(() => createDraft(kind, entities[0]));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [jsonOpen, setJsonOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entities.filter(
      (entity) =>
        !query ||
        [entity.name, entity.sortName, ...entity.alternativeNames]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
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
  const deleteMutation = useMutation({
    mutationFn: deleteEntities,
    onSuccess: async () => {
      const deleted = new Set(deletingIds);
      await refresh();
      setSelectedIds((current) => new Set([...current].filter((id) => !deleted.has(id))));
      if (draft.id && deleted.has(draft.id)) setDraft(createDraft(kind));
      setDeletingIds([]);
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
    <div className="flex min-w-0 flex-col gap-8">
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
      <div className="mr-0 grid min-w-0 gap-6 p-6 pt-0 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="max-h-full min-h-96">
          <CardHeader className="gap-3">
            <CardTitle>{label}</CardTitle>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث…"
                className="pe-9"
              />
            </div>
            {selectedIds.size ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{selectedIds.size} محدد</Badge>
                <Button size="sm" variant="outline" onClick={() => setJsonOpen(true)}>
                  <BracketsCurlyIcon data-icon="inline-start" /> JSON
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeletingIds([...selectedIds])}
                >
                  <TrashIcon data-icon="inline-start" /> حذف
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field orientation="horizontal" className="border-b pb-3">
              <Checkbox
                id={`entities-select-all-${kind}`}
                checked={allVisibleSelected}
                onCheckedChange={(value) => toggleVisible(value === true)}
              />
              <FieldLabel htmlFor={`entities-select-all-${kind}`}>تحديد النتائج الحالية</FieldLabel>
            </Field>
            <div className="flex max-h-150 flex-col gap-1 overflow-y-auto">
              {filtered.map((entity) => {
                const checked = selectedIds.has(entity.id);
                return (
                  <div
                    key={entity.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 hover:bg-muted",
                      draft.id === entity.id && "bg-muted",
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
                      <span className="text-xs text-muted-foreground">{entity.workCount} عمل</span>
                    </button>
                    <Badge variant="outline">{entity.alternativeNames.length}</Badge>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => setDeletingIds([entity.id])}
                      aria-label={`حذف ${entity.name}`}
                    >
                      <TrashIcon />
                    </Button>
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
            </CardHeader>
            <CardContent>
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
                    <FieldLabel htmlFor="entity-image">مسار الصورة</FieldLabel>
                    <Input
                      id="entity-image"
                      value={draft.imagePath ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, imagePath: event.target.value || null })
                      }
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="entity-established">تاريخ الميلاد / التأسيس</FieldLabel>
                    <Input
                      id="entity-established"
                      value={draft.establishedAt ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, establishedAt: event.target.value || null })
                      }
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="entity-aliases">الأسماء البديلة</FieldLabel>
                  <Textarea
                    id="entity-aliases"
                    value={draft.aliasesText}
                    onChange={(event) => setDraft({ ...draft, aliasesText: event.target.value })}
                    rows={4}
                    placeholder="اسم واحد في كل سطر"
                    dir="auto"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="entity-provider">مزود المصدر</FieldLabel>
                    <Input
                      id="entity-provider"
                      value={draft.sourceProvider ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, sourceProvider: event.target.value || null })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="entity-url">رابط المصدر</FieldLabel>
                    <Input
                      id="entity-url"
                      type="url"
                      value={draft.sourceUrl ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, sourceUrl: event.target.value || null })
                      }
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="entity-identities">المعرّفات الخارجية</FieldLabel>
                  <Textarea
                    id="entity-identities"
                    value={draft.identitiesText}
                    onChange={(event) => setDraft({ ...draft, identitiesText: event.target.value })}
                    rows={4}
                    placeholder="provider | external id | optional URL"
                    dir="ltr"
                  />
                </Field>
                {mutation.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{mutation.error.message}</AlertDescription>
                  </Alert>
                ) : null}
              </FieldGroup>
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
      <DeleteEntitiesDialog
        ids={deletingIds}
        open={deletingIds.length > 0}
        onOpenChange={(open) => !open && setDeletingIds([])}
        onConfirm={() => deleteMutation.mutate({ data: { ids: deletingIds } })}
        pending={deleteMutation.isPending}
        error={deleteMutation.error?.message}
      />
    </div>
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
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: saveEntities,
    onSuccess: async () => {
      await onSaved();
      onOpenChange(false);
    },
  });
  useEffect(() => {
    if (open) {
      setJson(
        JSON.stringify(
          { schemaVersion: 1, entities: entities.map((entity) => createDraft(kind, entity)) },
          null,
          2,
        ),
      );
      setError("");
    }
  }, [entities, kind, open]);
  const save = () => {
    try {
      const parsed = JSON.parse(json) as { schemaVersion?: unknown; entities?: unknown };
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.entities)) {
        throw new Error("يجب أن يحتوي المستند على schemaVersion: 1 ومصفوفة entities.");
      }
      const selected = new Set(entities.map(({ id }) => id));
      const inputs = parsed.entities.map((entity) => adminEntityInputSchema.parse(entity));
      if (
        inputs.length !== selected.size ||
        inputs.some(
          (entity) => !entity.id || !selected.has(entity.id) || entity.entityType !== kind,
        )
      ) {
        throw new Error("احتفظ بالكيانات المحددة نفسها وبنوع الكيان، ولا تضف أو تحذف سجلات هنا.");
      }
      setError("");
      mutation.mutate({ data: { entities: inputs } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88dvh,48rem)] max-w-[min(56rem,calc(100vw-2rem))] flex-col">
        <DialogHeader>
          <DialogTitle>تحرير JSON للكيانات المحددة</DialogTitle>
          <DialogDescription>
            تظهر فقط الكيانات المحددة. لا يمكن تغيير المعرّفات أو نوع الكيان، ويُتحقق من كل سجل قبل
            الحفظ.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={json}
          onChange={(event) => setJson(event.target.value)}
          className="min-h-0 flex-1 resize-none font-mono text-xs leading-6"
          dir="ltr"
          spellCheck={false}
          aria-label="محتوى JSON للكيانات"
        />
        {error || mutation.error ? (
          <Alert variant="destructive">
            <AlertTitle>تعذر الحفظ</AlertTitle>
            <AlertDescription>{error || mutation.error?.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            إلغاء
          </Button>
          <Button onClick={save} disabled={mutation.isPending}>
            <FloppyDiskIcon data-icon="inline-start" />
            {mutation.isPending ? "جارٍ الحفظ…" : "تحقق واحفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEntitiesDialog({
  ids,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف {ids.length} كيان</DialogTitle>
          <DialogDescription>
            سيُحذف الملف والأسماء البديلة والمعرّفات الخارجية وصورة الملف، وتُزال مساهماته من الأعمال
            المرتبطة. لا يمكن التراجع عن هذا الإجراء.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            <TrashIcon data-icon="inline-start" />
            {pending ? "جارٍ الحذف…" : "حذف نهائياً"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
