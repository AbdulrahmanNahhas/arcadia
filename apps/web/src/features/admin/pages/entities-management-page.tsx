import {
  BracketsCurlyIcon,
  CheckIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminEntityInput,
  adminEntityInputSchema,
  type Entity,
  type Work,
} from "@/features/library/model";
import { cn } from "@/lib/utils";
import {
  deleteEntities,
  deleteEntityContribution,
  getAdminEntities,
  getAdminVocabularyTerms,
  getAdminWorks,
  saveEntities,
  saveEntity,
  saveEntityContribution,
  uploadEntityImage,
} from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

type EntityKind = Entity["entityType"];
type Draft = AdminEntityInput;
type EntityDocument = { schemaVersion: 2; entities: AdminEntityInput[] };

const number = new Intl.NumberFormat("ar");

/** `FileReader#result` is `string | ArrayBuffer | null` in general — narrows it down for the
 *  `readAsDataURL` case, where it's always a `string` (a data: URL) or `null` on failure. */
function isFileReaderStringResult(value: FileReader["result"]): value is string {
  return typeof value === "string";
}

function createDraft(kind: EntityKind, entity?: Entity): Draft {
  return {
    id: entity?.id,
    name: entity?.name ?? "",
    sortName: entity?.sortName ?? "",
    entityType: kind,
    description: entity?.description ?? "",
    imagePath: entity?.imagePath ?? null,
    aliases: entity?.aliases ?? [],
  };
}

function initials(name: string) {
  return name.trim().slice(0, 2) || "؟";
}

export function EntitiesManagementPage({ kind }: { kind: EntityKind }) {
  const queryClient = useQueryClient();
  const { data: allEntities } = useSuspenseQuery({
    queryKey: ["admin-entities"],
    queryFn: () => getAdminEntities(),
  });
  const { data: works } = useSuspenseQuery({
    queryKey: ["admin-works"],
    queryFn: () => getAdminWorks(),
  });
  const { data: vocabulary } = useSuspenseQuery({
    queryKey: ["admin-vocabularies"],
    queryFn: () => getAdminVocabularyTerms(),
  });
  const entities = useMemo(
    () =>
      allEntities
        .filter((entity) => entity.entityType === kind)
        .toSorted(
          (left, right) =>
            right.workCount - left.workCount || left.sortName.localeCompare(right.sortName),
        ),
    [allEntities, kind],
  );
  const roleOptions = vocabulary.filter(
    (term) => term.vocabulary === "roles" && term.entityType === kind && term.isActive,
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft>(() => createDraft(kind, entities[0]));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [jsonOpen, setJsonOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const selectedEntity = entities.find((entity) => entity.id === draft.id);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entities.filter(
      (entity) =>
        !query ||
        [entity.name, entity.sortName, ...entity.aliases]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
    );
  }, [entities, search]);
  const privateLinks = entities.reduce(
    (total, entity) => total + entity.works.filter((work) => work.isPrivate).length,
    0,
  );
  const contributionCount = entities.reduce(
    (total, entity) =>
      total + entity.works.reduce((sum, work) => sum + work.contributions.length, 0),
    0,
  );
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-entities"] }),
      queryClient.invalidateQueries({ queryKey: ["entities"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-overview-v2"] }),
    ]);
  };
  const saveMutation = useMutation({
    mutationFn: saveEntity,
    onSuccess: async (saved) => {
      await refresh();
      setDraft(createDraft(kind, saved));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteEntities,
    onSuccess: async () => {
      const deletedId = deleteTarget?.id;
      setDeleteTarget(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        if (deletedId) next.delete(deletedId);
        return next;
      });
      setDraft(
        createDraft(
          kind,
          entities.find((entity) => entity.id !== deletedId),
        ),
      );
      await refresh();
    },
  });
  const selectEntity = (entity?: Entity) => setDraft(createDraft(kind, entity));
  const dirty = selectedEntity
    ? JSON.stringify(createDraft(kind, selectedEntity)) !== JSON.stringify(draft)
    : Boolean(draft.name || draft.description || draft.aliases.length || draft.imagePath);
  const selectWithGuard = (entity?: Entity) => {
    if (dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تجاهلها؟")) return;
    selectEntity(entity);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    saveMutation.mutate({ data: adminEntityInputSchema.parse(draft) });
  };
  const label = kind === "person" ? "الأشخاص" : "الاستوديوهات والمنظمات";
  const jsonEntities = selectedIds.size
    ? entities.filter(({ id }) => selectedIds.has(id))
    : selectedEntity
      ? [selectedEntity]
      : entities;

  useEffect(() => {
    if (draft.id && !entities.some((entity) => entity.id === draft.id)) {
      setDraft(createDraft(kind, entities[0]));
    }
  }, [draft.id, entities, kind]);

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <AdminPageHeader
        title={`إدارة ${label}`}
        description="مساحة معرفة مرتبطة مباشرة بمخطط PostgreSQL v2؛ الأعداد والمساهمات تشمل الأعمال العامة والخاصة."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setJsonOpen(true)}>
              <BracketsCurlyIcon data-icon="inline-start" /> JSON
            </Button>
            <Button onClick={() => selectWithGuard()}>
              <PlusIcon data-icon="inline-start" /> سجل جديد
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 px-5 sm:grid-cols-3 sm:px-6">
        <Metric label={label} value={entities.length} detail="كل السجلات" />
        <Metric label="المساهمات" value={contributionCount} detail="كل الأدوار المرتبطة" />
        <Metric label="روابط خاصة" value={privateLinks} detail="مضمّنة في جميع الأعداد" />
      </div>

      <div className="grid min-w-0 gap-6 px-5 sm:px-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)]">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{label}</CardTitle>
                <CardDescription>{number.format(filtered.length)} نتيجة</CardDescription>
              </div>
              {selectedIds.size ? <Badge>{number.format(selectedIds.size)} محدد</Badge> : null}
            </div>
            <InputGroup>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="الاسم أو الاسم البديل…"
              />
              <InputGroupAddon align="inline-end">
                <MagnifyingGlassIcon />
              </InputGroupAddon>
            </InputGroup>
            {selectedIds.size ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setJsonOpen(true)}>
                  <BracketsCurlyIcon data-icon="inline-start" /> تحرير المحدد
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  مسح التحديد
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {filtered.map((entity) => (
              <div
                key={entity.id}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border p-2 transition-colors",
                  draft.id === entity.id ? "bg-muted" : "border-transparent hover:bg-muted/60",
                )}
              >
                <Checkbox
                  checked={selectedIds.has(entity.id)}
                  onCheckedChange={(checked) =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (checked) next.add(entity.id);
                      else next.delete(entity.id);
                      return next;
                    })
                  }
                  aria-label={`تحديد ${entity.name}`}
                />
                <button
                  type="button"
                  onClick={() => selectWithGuard(entity)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-start"
                >
                  <Avatar size="lg">
                    {entity.imagePath ? <AvatarImage src={entity.imagePath} alt="" /> : null}
                    <AvatarFallback>{initials(entity.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{entity.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {number.format(entity.workCount)} عمل · {number.format(entity.roles.length)}{" "}
                      أدوار
                    </span>
                  </span>
                </button>
                <Badge variant={entity.workCount ? "secondary" : "outline"}>
                  {number.format(entity.workCount)}
                </Badge>
              </div>
            ))}
            {!filtered.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد نتائج</EmptyTitle>
                  <EmptyDescription>جرّب اسماً بديلاً أو أنشئ سجلاً جديداً.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Tabs defaultValue={selectedEntity ? "works" : "identity"}>
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="identity">
                <UserIcon data-icon="inline-start" /> الهوية
              </TabsTrigger>
              <TabsTrigger value="works" disabled={!selectedEntity}>
                الأعمال <Badge variant="secondary">{selectedEntity?.workCount ?? 0}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="identity">
              <EntityIdentityCard
                kind={kind}
                draft={draft}
                setDraft={setDraft}
                dirty={dirty}
                mutation={saveMutation}
                submit={submit}
                onDelete={selectedEntity ? () => setDeleteTarget(selectedEntity) : undefined}
              />
            </TabsContent>
            <TabsContent value="works">
              {selectedEntity ? (
                <EntityWorksDesk
                  entity={selectedEntity}
                  works={works}
                  roleOptions={roleOptions}
                  onChanged={refresh}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <EntityDeleteDialog
        entity={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate({ data: { ids: [deleteTarget.id] } })
        }
        pending={deleteMutation.isPending}
        error={deleteMutation.error}
      />

      <EntityJsonEditor
        open={jsonOpen}
        onOpenChange={setJsonOpen}
        entities={jsonEntities}
        onSaved={async () => {
          setSelectedIds(new Set());
          await refresh();
        }}
      />
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-3xl tabular-nums">{number.format(value)}</CardTitle>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </CardHeader>
    </Card>
  );
}

function EntityIdentityCard({
  kind,
  draft,
  setDraft,
  dirty,
  mutation,
  submit,
  onDelete,
}: {
  kind: EntityKind;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  dirty: boolean;
  mutation: { isPending: boolean; error: Error | null };
  submit: (event: FormEvent) => void;
  onDelete?: () => void;
}) {
  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{draft.id ? "هوية السجل" : "إنشاء سجل"}</CardTitle>
              <CardDescription>
                الاسم، اسم الفرز، الأسماء البديلة، النبذة والصورة هي حقول الكيان الفعلية في v2.
              </CardDescription>
            </div>
            <Badge variant={dirty ? "secondary" : "outline"}>
              {dirty ? "تغييرات غير محفوظة" : "محفوظ"}
            </Badge>
          </div>
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
                    setDraft((current) => {
                      const next = { ...current, name: event.target.value };
                      if (!current.id) next.sortName = event.target.value.toLocaleLowerCase();
                      return next;
                    })
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
              <FieldLabel htmlFor="entity-aliases">الأسماء البديلة</FieldLabel>
              <Input
                id="entity-aliases"
                value={draft.aliases.join("، ")}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    aliases: event.target.value
                      .split(/[،,]/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="اسم فني، تهجئة بديلة…"
                dir="auto"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="entity-description">النبذة</FieldLabel>
              <Textarea
                id="entity-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                rows={6}
                dir="auto"
              />
            </Field>
            <EntityArtworkField
              kind={kind}
              value={draft.imagePath}
              onChange={(imagePath) => setDraft({ ...draft, imagePath })}
            />
            {mutation.error ? (
              <Alert variant="destructive">
                <AlertDescription>{mutation.error.message}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <div className="flex items-center gap-2">
            {onDelete ? (
              <Button type="button" variant="destructive" onClick={onDelete}>
                <TrashIcon data-icon="inline-start" /> حذف السجل
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {draft.id ? `المعرّف الثابت: ${draft.id}` : "سيُنشأ معرّف UUID عند الحفظ."}
            </span>
          </div>
          <Button type="submit" disabled={mutation.isPending || !dirty}>
            <FloppyDiskIcon data-icon="inline-start" />
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ الهوية"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function EntityWorksDesk({
  entity,
  works,
  roleOptions,
  onChanged,
}: {
  entity: Entity;
  works: Work[];
  roleOptions: Array<{ slug: string; labelAr: string }>;
  onChanged: () => Promise<void>;
}) {
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.slug ?? "");
  const [isPrimary, setIsPrimary] = useState(false);
  const saveMutation = useMutation({
    mutationFn: saveEntityContribution,
    onSuccess: async () => {
      await onChanged();
      setSelectedWorkId("");
      setIsPrimary(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteEntityContribution,
    onSuccess: onChanged,
  });
  const selectedWork = works.find((work) => work.id === selectedWorkId);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>إضافة عمل ودور</CardTitle>
          <CardDescription>
            اختر أي عنوان عام أو خاص ثم حدّد دوراً متوافقاً مع نوع السجل. العملية لا تمس بقية صنّاع
            العمل.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <Command className="h-72 rounded-2xl border">
            <CommandInput placeholder="ابحث في كل العناوين…" />
            <CommandList>
              <CommandEmpty>لا يوجد عنوان مطابق.</CommandEmpty>
              <CommandGroup heading="العناوين">
                {works.map((work) => (
                  <CommandItem
                    key={work.id}
                    value={`${work.title} ${work.arabicTitle ?? ""}`}
                    data-checked={selectedWorkId === work.id}
                    onSelect={() => setSelectedWorkId(work.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {work.arabicTitle || work.title}
                    </span>
                    {work.isPrivate ? <EyeSlashIcon /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <FieldGroup>
            <Field>
              <FieldLabel>العنوان المحدد</FieldLabel>
              <div className="rounded-xl border p-3 text-sm">
                {selectedWork ? selectedWork.arabicTitle || selectedWork.title : "لم يُحدد عنوان"}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="entity-role">الدور</FieldLabel>
              <Select
                items={roleOptions.map((item) => ({ value: item.slug, label: item.labelAr }))}
                value={role}
                onValueChange={(value) => setRole(value ?? "")}
              >
                <SelectTrigger id="entity-role" className="w-full">
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roleOptions.map((item) => (
                      <SelectItem key={item.slug} value={item.slug}>
                        {item.labelAr}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal">
              <Switch id="entity-primary-role" checked={isPrimary} onCheckedChange={setIsPrimary} />
              <FieldLabel htmlFor="entity-primary-role">مساهمة أساسية</FieldLabel>
            </Field>
            <Button
              disabled={!selectedWorkId || !role || saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({
                  data: {
                    entityId: entity.id,
                    titleId: selectedWorkId,
                    role,
                    isPrimary,
                    position: 0,
                  },
                })
              }
            >
              <PlusIcon data-icon="inline-start" /> إضافة الدور
            </Button>
          </FieldGroup>
        </CardContent>
        {saveMutation.error ? (
          <CardFooter>
            <Alert variant="destructive">
              <AlertDescription>{saveMutation.error.message}</AlertDescription>
            </Alert>
          </CardFooter>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأعمال المرتبطة</CardTitle>
          <CardDescription>
            {number.format(entity.workCount)} عنواناً، منها{" "}
            {number.format(entity.works.filter((work) => work.isPrivate).length)} خاصاً.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {entity.works.map((work) => (
            <div
              key={work.id}
              className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar size="lg">
                  {work.imagePath ? <AvatarImage src={work.imagePath} alt="" /> : null}
                  <AvatarFallback>{initials(work.arabicTitle || work.title)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/admin/catalog/$workId"
                    params={{ workId: work.id }}
                    className="font-medium hover:underline"
                  >
                    {work.arabicTitle || work.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {work.year ? <Badge variant="outline">{work.year}</Badge> : null}
                    {work.isPrivate ? (
                      <Badge variant="secondary">
                        <EyeSlashIcon data-icon="inline-start" /> خاص
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {work.contributions.map((contribution) => (
                  <div key={contribution.role} className="flex items-center rounded-xl border ps-2">
                    <span className="text-xs">
                      {contribution.roleLabelAr}
                      {contribution.isPrimary ? " · أساسي" : ""}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`إزالة دور ${contribution.roleLabelAr}`}
                      disabled={deleteMutation.isPending}
                      onClick={() =>
                        deleteMutation.mutate({
                          data: { entityId: entity.id, titleId: work.id, role: contribution.role },
                        })
                      }
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!entity.works.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد أعمال مرتبطة</EmptyTitle>
                <EmptyDescription>استخدم أداة الإضافة أعلاه لاختيار أول عمل ودور.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {deleteMutation.error ? (
            <Alert variant="destructive">
              <AlertDescription>{deleteMutation.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function EntityArtworkField({
  kind,
  value,
  onChange,
}: {
  kind: EntityKind;
  value: string | null;
  onChange: (imagePath: string | null) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const upload = useMutation({ mutationFn: uploadEntityImage });
  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file?.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (!isFileReaderStringResult(reader.result)) return;
      upload.mutate(
        { data: { dataUrl: reader.result, fileName: file.name } },
        { onSuccess: ({ relativePath }) => setCandidate(relativePath) },
      );
    });
    reader.readAsDataURL(file);
  };
  return (
    <Field>
      <FieldLabel>{kind === "person" ? "الصورة الشخصية" : "شعار أو صورة الاستوديو"}</FieldLabel>
      <div className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Avatar className="size-32 rounded-2xl">
          {candidate || value ? (
            <AvatarImage className="rounded-2xl" src={candidate || value || ""} alt="" />
          ) : null}
          <AvatarFallback className="rounded-2xl">
            <UserIcon />
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-3">
          <Input
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
            placeholder="مسار الصورة"
            dir="ltr"
          />
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={uploadFile}
            disabled={upload.isPending}
          />
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
              <CheckIcon data-icon="inline-start" /> اعتماد
            </Button>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                إزالة
              </Button>
            ) : null}
          </div>
          {upload.error ? (
            <Alert variant="destructive">
              <AlertDescription>{upload.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

function EntityDeleteDialog({
  entity,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  entity: Entity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  error: Error | null;
}) {
  const contributionCount =
    entity?.works.reduce((total, work) => total + work.contributions.length, 0) ?? 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>حذف {entity?.name ?? "السجل"}؟</DialogTitle>
          <DialogDescription>
            سيُحذف السجل وأسماؤه البديلة وصورته غير المستخدمة، وستُزال مساهماته من كل الأعمال. لن تُحذف
            الأعمال نفسها.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border p-3 text-center">
            <strong className="block font-mono text-2xl">{entity?.workCount ?? 0}</strong>
            <span className="text-xs text-muted-foreground">عمل مرتبط</span>
          </div>
          <div className="rounded-2xl border p-3 text-center">
            <strong className="block font-mono text-2xl">{contributionCount}</strong>
            <span className="text-xs text-muted-foreground">مساهمة</span>
          </div>
          <div className="rounded-2xl border p-3 text-center">
            <strong className="block font-mono text-2xl">
              {entity?.works.filter((work) => work.isPrivate).length ?? 0}
            </strong>
            <span className="text-xs text-muted-foreground">عمل خاص</span>
          </div>
        </div>
        <Alert variant="destructive">
          <TrashIcon />
          <AlertTitle>لا يمكن التراجع عن الحذف</AlertTitle>
          <AlertDescription>
            استخدم إزالة الدور من تبويب الأعمال إذا كنت تريد فقط فك ارتباط عمل واحد.
          </AlertDescription>
        </Alert>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="flex-row justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            <TrashIcon data-icon="inline-start" />
            {pending ? "جارٍ الحذف…" : "حذف السجل نهائياً"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntityJsonEditor({
  open,
  onOpenChange,
  entities,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onSaved: () => Promise<void>;
}) {
  const source = useMemo<EntityDocument>(
    () => ({
      schemaVersion: 2,
      entities: entities.map((entity) => createDraft(entity.entityType, entity)),
    }),
    [entities],
  );
  const [json, setJson] = useState("");
  const [review, setReview] = useState<AdminEntityInput[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setJson(JSON.stringify(source, null, 2));
    setReview(null);
    setError("");
  }, [open, source]);
  const mutation = useMutation({
    mutationFn: saveEntities,
    onSuccess: async () => {
      await onSaved();
      onOpenChange(false);
    },
  });
  const prepareReview = () => {
    try {
      // SAFETY: this only widens `JSON.parse`'s `any` to a shape whose fields are still
      // `unknown` — the checks immediately below validate `schemaVersion` and `entities` before
      // anything here is trusted further.
      const parsed = JSON.parse(json) as { schemaVersion?: unknown; entities?: unknown };
      if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.entities))
        throw new Error("يجب أن يحتوي المستند على schemaVersion: 2 ومصفوفة entities.");
      const next = parsed.entities.map((entity) => adminEntityInputSchema.parse(entity));
      const sourceIds = new Set(source.entities.map((entity) => entity.id));
      if (next.some((entity) => !entity.id || !sourceIds.has(entity.id)))
        throw new Error("لا تغيّر المعرّفات ولا تضف سجلات جديدة من محرر JSON المجمع.");
      setReview(next);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex h-[min(90dvh,52rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden p-0"
      >
        <DialogHeader className="border-b p-5 text-right">
          <DialogTitle>محرر JSON لمخطط الكيانات v2</DialogTitle>
          <DialogDescription>
            يحرر كل حقول الكيان الموجودة فعلياً: الهوية، الأسماء البديلة، النبذة ومسار الصورة.
            المساهمات تُدار بأمان من تبويب الأعمال.
          </DialogDescription>
        </DialogHeader>
        {review ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <Alert>
              <CheckIcon />
              <AlertTitle>المستند صالح وجاهز</AlertTitle>
              <AlertDescription>
                {number.format(review.length)} سجلاً سيُحفظ. المعرّفات والعلاقات لن تتغير.
              </AlertDescription>
            </Alert>
            <Separator className="my-5" />
            <div className="flex flex-col gap-3">
              {review.map((entity) => (
                <Card key={entity.id}>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">{entity.name}</CardTitle>
                    <CardDescription>
                      {entity.aliases.length} أسماء بديلة · {entity.entityType}
                    </CardDescription>
                  </CardHeader>
                </Card>
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
              className="h-full resize-none font-mono text-xs leading-6"
              dir="ltr"
              spellCheck={false}
            />
          </div>
        )}
        {error || mutation.error ? (
          <div className="px-5 pb-4">
            <Alert variant="destructive">
              <AlertTitle>تعذر المتابعة</AlertTitle>
              <AlertDescription>{error || mutation.error?.message}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <DialogFooter className="flex-row justify-between border-t p-4">
          <Button
            variant="outline"
            onClick={() => (review ? setReview(null) : onOpenChange(false))}
          >
            {review ? "العودة إلى التحرير" : "إلغاء"}
          </Button>
          {review ? (
            <Button
              onClick={() => mutation.mutate({ data: { entities: review } })}
              disabled={mutation.isPending}
            >
              <FloppyDiskIcon data-icon="inline-start" />{" "}
              {mutation.isPending ? "جارٍ الحفظ…" : "تطبيق التغييرات"}
            </Button>
          ) : (
            <Button onClick={prepareReview}>
              <CheckIcon data-icon="inline-start" /> مراجعة المستند
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
