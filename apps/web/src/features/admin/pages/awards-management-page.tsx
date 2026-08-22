import type {
  AdminAwardCategoryInput,
  AdminAwardCeremonyInput,
  AdminAwardOrganizationInput,
  AdminAwardsDocument,
} from "@arcadia/contracts";
import {
  CodeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createAwardCategory,
  createAwardOrganization,
  deleteAwardCategory,
  deleteAwardCeremony,
  deleteAwardOrganization,
  deleteAwardRecognition,
  getAdminAwards,
  getAdminWorks,
  saveAwardCategory,
  saveAwardCeremony,
  saveAwardOrganization,
} from "@/server/library.functions";
import { AwardRecognitionForm } from "../awards/recognition-editor";
import { AdminPageHeader } from "../components/admin-page-header";
import { MutationErrorAlert } from "../components/mutation-error-alert";

type AwardOrganization = AdminAwardsDocument["organizations"][number];
type AwardCategory = AwardOrganization["categories"][number];
type AwardRecognition = AdminAwardsDocument["recognitions"][number];
type AwardCeremony = AdminAwardsDocument["ceremonies"][number];
type DeleteTarget =
  | { kind: "organization"; item: AwardOrganization }
  | { kind: "category"; item: AwardCategory }
  | { kind: "recognition"; item: AwardRecognition }
  | { kind: "ceremony"; item: AwardCeremony };

const awardsKey = ["admin", "awards", "management"] as const;
const number = new Intl.NumberFormat("ar");

function organizationDraft(organization: AwardOrganization): AdminAwardOrganizationInput {
  return {
    id: organization.id,
    slug: organization.slug,
    nameAr: organization.nameAr,
    nameEn: organization.nameEn,
    description: organization.description,
    websiteUrl: organization.websiteUrl,
    logoPath: organization.logoPath,
    isActive: organization.isActive,
  };
}

function categoryDraft(organizationId: string, category: AwardCategory): AdminAwardCategoryInput {
  return {
    id: category.id,
    organizationId,
    slug: category.slug,
    nameAr: category.nameAr,
    nameEn: category.nameEn,
    description: category.description,
    isActive: category.isActive,
  };
}

function ceremonyDraft(organizationId: string, ceremony: AwardCeremony): AdminAwardCeremonyInput {
  return {
    id: ceremony.id,
    organizationId,
    year: ceremony.year,
    edition: ceremony.edition,
    label: ceremony.label,
    heldOn: ceremony.heldOn,
    sourceUrl: ceremony.sourceUrl,
  };
}

export function AwardsManagementPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: awardsKey, queryFn: getAdminAwards });
  const { data: works } = useSuspenseQuery({
    queryKey: ["admin-works"],
    queryFn: () => getAdminWorks(),
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(data.organizations[0]?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const selected =
    data.organizations.find((organization) => organization.id === selectedId) ??
    data.organizations[0];
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data.organizations.filter(
      (organization) =>
        !query ||
        [organization.nameAr, organization.nameEn ?? "", organization.slug]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
    );
  }, [data.organizations, search]);
  const refresh = async () => {
    // Award mutations never change the title catalog itself, so — unlike before — this no
    // longer invalidates `["admin-works"]`: refetching the entire unpaginated catalog on every
    // award save/delete was pure waste. `RecognitionEditor`'s work picker is search-driven now
    // (see `searchAdminWorks`), not backed by this page's `works` at all.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: awardsKey }),
      queryClient.invalidateQueries({ queryKey: ["admin", "awards", "options"] }),
    ]);
  };
  const deleteMutation = useMutation({
    mutationFn: async (target: DeleteTarget) => {
      if (target.kind === "organization")
        return deleteAwardOrganization({ data: { id: target.item.id } });
      if (target.kind === "category") return deleteAwardCategory({ data: { id: target.item.id } });
      if (target.kind === "ceremony") return deleteAwardCeremony({ data: { id: target.item.id } });
      return deleteAwardRecognition({ data: { id: target.item.id } });
    },
    onSuccess: async () => {
      const deletedOrganizationId =
        deleteTarget?.kind === "organization" ? deleteTarget.item.id : null;
      setDeleteTarget(null);
      if (deletedOrganizationId === selectedId) {
        setSelectedId(
          data.organizations.find((organization) => organization.id !== deletedOrganizationId)
            ?.id ?? "",
        );
      }
      await refresh();
    },
  });
  const totalRecognitions = data.recognitions.length;
  const totalWorks = new Set(data.recognitions.map((recognition) => recognition.titleId)).size;
  const winnerCount = data.recognitions.filter(
    (recognition) => recognition.result === "winner",
  ).length;

  useEffect(() => {
    if (selectedId && !data.organizations.some((organization) => organization.id === selectedId)) {
      setSelectedId(data.organizations[0]?.id ?? "");
    }
  }, [data.organizations, selectedId]);

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <AdminPageHeader
        title="إدارة الجوائز"
        description="إدارة الجهات والفئات والتكريمات من مكان واحد، وربط الأعمال العامة والخاصة بفوز أو ترشيح."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" /> جهة مانحة جديدة
          </Button>
        }
      />

      <div className="grid gap-3 px-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        <Metric label="الجهات المانحة" value={data.organizations.length} />
        <Metric label="التكريمات" value={totalRecognitions} />
        <Metric label="الأعمال المكرّمة" value={totalWorks} />
        <Metric label="مرات الفوز" value={winnerCount} />
      </div>

      <div className="grid min-w-0 gap-6 px-5 sm:px-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <Card className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)]">
          <CardHeader className="gap-4">
            <div>
              <CardTitle>دليل الجوائز</CardTitle>
              <CardDescription>يشمل الجهات النشطة والمؤرشفة.</CardDescription>
            </div>
            <InputGroup>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="الاسم العربي أو الإنجليزي…"
              />
              <InputGroupAddon align="inline-end">
                <MagnifyingGlassIcon />
              </InputGroupAddon>
            </InputGroup>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {filtered.map((organization) => (
              <button
                key={organization.id}
                type="button"
                onClick={() => setSelectedId(organization.id)}
                className="flex items-center gap-3 rounded-2xl border p-3 text-start transition-colors data-[active=true]:bg-muted data-[active=false]:border-transparent data-[active=false]:hover:bg-muted/60"
                data-active={selected?.id === organization.id}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <TrophyIcon weight={organization.winnerCount ? "duotone" : "regular"} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{organization.nameAr}</strong>
                  <span className="text-xs text-muted-foreground">
                    {number.format(organization.recognitionCount)} تكريم ·{" "}
                    {number.format(organization.workCount)} عمل
                  </span>
                </span>
                {!organization.isActive ? <Badge variant="outline">مؤرشفة</Badge> : null}
              </button>
            ))}
            {!filtered.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد نتائج</EmptyTitle>
                  <EmptyDescription>غيّر البحث أو أضف جهة مانحة.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </CardContent>
        </Card>

        {selected ? (
          <Tabs defaultValue="recognitions" key={selected.id}>
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="identity">الهوية</TabsTrigger>
              <TabsTrigger value="categories">
                الفئات <Badge variant="secondary">{selected.categories.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="recognitions">
                الأعمال <Badge variant="secondary">{selected.recognitionCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="ceremonies">
                الحفلات{" "}
                <Badge variant="secondary">
                  {
                    data.ceremonies.filter((ceremony) => ceremony.organizationId === selected.id)
                      .length
                  }
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="json">
                JSON <CodeIcon data-icon="inline-end" />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="identity">
              <OrganizationEditor
                organization={selected}
                onSaved={refresh}
                onDelete={() => setDeleteTarget({ kind: "organization", item: selected })}
              />
            </TabsContent>
            <TabsContent value="categories">
              <CategoriesDesk
                organization={selected}
                onChanged={refresh}
                onDelete={(category) => setDeleteTarget({ kind: "category", item: category })}
              />
            </TabsContent>
            <TabsContent value="recognitions">
              <RecognitionsDesk
                organization={selected}
                recognitions={data.recognitions.filter(
                  (recognition) => recognition.organizationId === selected.id,
                )}
                onChanged={refresh}
                onDelete={(recognition) =>
                  setDeleteTarget({ kind: "recognition", item: recognition })
                }
              />
            </TabsContent>
            <TabsContent value="ceremonies">
              <CeremoniesDesk
                organization={selected}
                ceremonies={data.ceremonies.filter(
                  (ceremony) => ceremony.organizationId === selected.id,
                )}
                onChanged={refresh}
                onDelete={(ceremony) => setDeleteTarget({ kind: "ceremony", item: ceremony })}
              />
            </TabsContent>
            <TabsContent value="json">
              <RecognitionJsonViewer
                organization={selected}
                recognitions={data.recognitions.filter(
                  (recognition) => recognition.organizationId === selected.id,
                )}
                works={works}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <Empty className="rounded-3xl border">
            <EmptyHeader>
              <EmptyTitle>أضف أول جهة مانحة</EmptyTitle>
              <EmptyDescription>
                الجهة تحتوي فئاتها، ثم يمكن ربط الأعمال بها كفائزة أو مرشحة.
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" /> إضافة جهة
            </Button>
          </Empty>
        )}
      </div>

      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (id) => {
          setSelectedId(id);
          await refresh();
        }}
      />
      <DeleteAwardDialog
        target={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        pending={deleteMutation.isPending}
        error={deleteMutation.error}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-3xl tabular-nums">{number.format(value)}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function OrganizationEditor({
  organization,
  onSaved,
  onDelete,
}: {
  organization: AwardOrganization;
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(() => organizationDraft(organization));
  const mutation = useMutation({ mutationFn: saveAwardOrganization, onSuccess: onSaved });
  const dirty = JSON.stringify(draft) !== JSON.stringify(organizationDraft(organization));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ data: draft });
  };
  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>هوية الجائزة</CardTitle>
              <CardDescription>
                تغيير الاسم العربي أو المعرّف يحدّث كل التكريمات المرتبطة تلقائياً.
              </CardDescription>
            </div>
            <Badge variant={organization.isActive ? "secondary" : "outline"}>
              {organization.isActive ? "نشطة" : "مؤرشفة"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="mt-6">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="award-name-ar">الاسم العربي</FieldLabel>
                <Input
                  id="award-name-ar"
                  value={draft.nameAr}
                  onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="award-name-en">الاسم الإنجليزي</FieldLabel>
                <Input
                  id="award-name-en"
                  dir="ltr"
                  value={draft.nameEn ?? ""}
                  onChange={(event) => setDraft({ ...draft, nameEn: event.target.value || null })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="award-slug">المعرّف</FieldLabel>
                <Input
                  id="award-slug"
                  dir="ltr"
                  value={draft.slug}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="award-website">الموقع الرسمي</FieldLabel>
                <Input
                  id="award-website"
                  type="url"
                  dir="ltr"
                  value={draft.websiteUrl ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, websiteUrl: event.target.value || null })
                  }
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="award-description">الوصف</FieldLabel>
              <Textarea
                id="award-description"
                rows={5}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="award-logo">مسار الشعار</FieldLabel>
              <Input
                id="award-logo"
                dir="ltr"
                value={draft.logoPath ?? ""}
                onChange={(event) => setDraft({ ...draft, logoPath: event.target.value || null })}
              />
            </Field>
            <Field orientation="horizontal">
              <Switch
                id="award-active"
                checked={draft.isActive}
                onCheckedChange={(isActive) => setDraft({ ...draft, isActive })}
              />
              <FieldLabel htmlFor="award-active">متاحة عند إضافة تكريمات جديدة</FieldLabel>
            </Field>
            <MutationErrorAlert error={mutation.error} />
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <Button type="button" variant="destructive" onClick={onDelete}>
            <TrashIcon data-icon="inline-start" /> حذف الجائزة
          </Button>
          <Button type="submit" disabled={!dirty || mutation.isPending}>
            <FloppyDiskIcon data-icon="inline-start" />{" "}
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ الهوية"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function CategoriesDesk({
  organization,
  onChanged,
  onDelete,
}: {
  organization: AwardOrganization;
  onChanged: () => Promise<void>;
  onDelete: (category: AwardCategory) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>فئات {organization.nameAr}</CardTitle>
            <CardDescription>مثل أفضل فيلم، أفضل إخراج، أو اختيار الجمهور.</CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" /> فئة جديدة
          </Button>
        </CardHeader>
      </Card>
      {organization.categories.map((category) => (
        <CategoryEditor
          key={category.id}
          organizationId={organization.id}
          category={category}
          onSaved={onChanged}
          onDelete={() => onDelete(category)}
        />
      ))}
      {!organization.categories.length ? (
        <Empty className="rounded-3xl border">
          <EmptyHeader>
            <EmptyTitle>لا توجد فئات</EmptyTitle>
            <EmptyDescription>أضف فئة قبل ربط الأعمال بهذه الجائزة.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <CreateCategoryDialog
        organization={organization}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onChanged}
      />
    </div>
  );
}

function CategoryEditor({
  organizationId,
  category,
  onSaved,
  onDelete,
}: {
  organizationId: string;
  category: AwardCategory;
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(() => categoryDraft(organizationId, category));
  const mutation = useMutation({ mutationFn: saveAwardCategory, onSuccess: onSaved });
  const dirty = JSON.stringify(draft) !== JSON.stringify(categoryDraft(organizationId, category));
  return (
    <Card size="sm">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{category.nameAr}</CardTitle>
          <CardDescription>{number.format(category.recognitionCount)} تكريم</CardDescription>
        </div>
        <Badge variant={category.isActive ? "secondary" : "outline"}>
          {category.isActive ? "نشطة" : "مؤرشفة"}
        </Badge>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel>الاسم العربي</FieldLabel>
              <Input
                value={draft.nameAr}
                onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>الاسم الإنجليزي</FieldLabel>
              <Input
                dir="ltr"
                value={draft.nameEn ?? ""}
                onChange={(event) => setDraft({ ...draft, nameEn: event.target.value || null })}
              />
            </Field>
            <Field>
              <FieldLabel>المعرّف</FieldLabel>
              <Input
                dir="ltr"
                value={draft.slug}
                onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>الوصف</FieldLabel>
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </Field>
          <Field orientation="horizontal">
            <Switch
              checked={draft.isActive}
              onCheckedChange={(isActive) => setDraft({ ...draft, isActive })}
            />
            <FieldLabel>متاحة للاختيار</FieldLabel>
          </Field>
          <MutationErrorAlert error={mutation.error} />
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onDelete}>
          <TrashIcon data-icon="inline-start" /> حذف الفئة
        </Button>
        <Button
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate({ data: draft })}
        >
          <FloppyDiskIcon data-icon="inline-start" /> حفظ
        </Button>
      </CardFooter>
    </Card>
  );
}

function CeremoniesDesk({
  organization,
  ceremonies,
  onChanged,
  onDelete,
}: {
  organization: AwardOrganization;
  ceremonies: AwardCeremony[];
  onChanged: () => Promise<void>;
  onDelete: (ceremony: AwardCeremony) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>حفلات {organization.nameAr}</CardTitle>
            <CardDescription>
              تُنشأ تلقائياً عند حفظ أول تكريم لسنة معيّنة؛ عدّلها هنا لضبط الاسم والدورة وتاريخ الحفل.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" /> حفل جديد
          </Button>
        </CardHeader>
      </Card>
      {ceremonies
        .toSorted((left, right) => right.year - left.year)
        .map((ceremony) => (
          <CeremonyEditor
            key={ceremony.id}
            organizationId={organization.id}
            ceremony={ceremony}
            onSaved={onChanged}
            onDelete={() => onDelete(ceremony)}
          />
        ))}
      {!ceremonies.length ? (
        <Empty className="rounded-3xl border">
          <EmptyHeader>
            <EmptyTitle>لا توجد حفلات مسجّلة بعد</EmptyTitle>
            <EmptyDescription>
              ستُنشأ تلقائياً عند إضافة أول تكريم بسنة معيّنة، أو أضف واحداً يدوياً.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <CreateCeremonyDialog
        organization={organization}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onChanged}
      />
    </div>
  );
}

function CeremonyEditor({
  organizationId,
  ceremony,
  onSaved,
  onDelete,
}: {
  organizationId: string;
  ceremony: AwardCeremony;
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(() => ceremonyDraft(organizationId, ceremony));
  const mutation = useMutation({ mutationFn: saveAwardCeremony, onSuccess: onSaved });
  const dirty = JSON.stringify(draft) !== JSON.stringify(ceremonyDraft(organizationId, ceremony));
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>حفل {ceremony.year}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel>السنة</FieldLabel>
              <Input
                type="number"
                min="1900"
                max="2100"
                value={draft.year}
                onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
              />
            </Field>
            <Field>
              <FieldLabel>الدورة</FieldLabel>
              <Input
                type="number"
                min="1"
                value={draft.edition ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    edition: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel>تاريخ الحفل</FieldLabel>
              <Input
                type="date"
                value={draft.heldOn ?? ""}
                onChange={(event) => setDraft({ ...draft, heldOn: event.target.value || null })}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>الاسم المعروض</FieldLabel>
            <Input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>رابط المصدر</FieldLabel>
            <Input
              type="url"
              dir="ltr"
              value={draft.sourceUrl ?? ""}
              onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value || null })}
            />
          </Field>
          <MutationErrorAlert error={mutation.error} />
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onDelete}>
          <TrashIcon data-icon="inline-start" /> حذف الحفل
        </Button>
        <Button
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate({ data: draft })}
        >
          <FloppyDiskIcon data-icon="inline-start" /> حفظ
        </Button>
      </CardFooter>
    </Card>
  );
}

function CreateCeremonyDialog({
  organization,
  open,
  onOpenChange,
  onCreated,
}: {
  organization: AwardOrganization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ year: new Date().getFullYear(), label: "" });
  const mutation = useMutation({
    mutationFn: saveAwardCeremony,
    onSuccess: async () => {
      onOpenChange(false);
      setDraft({ year: new Date().getFullYear(), label: "" });
      await onCreated();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>حفل جديد في {organization.nameAr}</DialogTitle>
          <DialogDescription>
            إن كان هناك حفل مسجّل بالفعل لنفس السنة، سيُحدَّث بدلاً من إنشاء حفل مكرَّر.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>السنة</FieldLabel>
            <Input
              type="number"
              min="1900"
              max="2100"
              value={draft.year}
              onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel>الاسم المعروض (اختياري)</FieldLabel>
            <Input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
          </Field>
        </FieldGroup>
        <MutationErrorAlert error={mutation.error} />
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                data: {
                  organizationId: organization.id,
                  year: draft.year,
                  edition: null,
                  label: draft.label || String(draft.year),
                  heldOn: null,
                  sourceUrl: null,
                },
              })
            }
          >
            <PlusIcon data-icon="inline-start" /> إضافة الحفل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecognitionJsonViewer({
  organization,
  recognitions,
  works,
}: {
  organization: AwardOrganization;
  recognitions: AwardRecognition[];
  works: Awaited<ReturnType<typeof getAdminWorks>>;
}) {
  const [mediaType, setMediaType] = useState("all");
  const [result, setResult] = useState<"all" | "winner" | "nominee">("all");
  const worksById = useMemo(() => new Map(works.map((work) => [work.id, work])), [works]);
  const mediaTypes = useMemo(
    () =>
      [
        ...new Set(
          recognitions.flatMap((recognition) => [worksById.get(recognition.titleId)?.kind]),
        ),
      ]
        .filter((kind) => kind !== undefined)
        .toSorted(),
    [recognitions, worksById],
  );
  const document = useMemo(
    () =>
      recognitions
        .filter((recognition) => {
          const work = worksById.get(recognition.titleId);
          return (
            (mediaType === "all" || work?.kind === mediaType) &&
            (result === "all" || recognition.result === result)
          );
        })
        .map((recognition) => {
          const work = worksById.get(recognition.titleId);
          return {
            title: recognition.title,
            id: recognition.titleId,
            mediaType: work?.kind ?? null,
            award: {
              organization: organization.nameEn ?? organization.nameAr,
              category: recognition.category,
              result: recognition.result,
              year: recognition.year,
              installment: recognition.installmentTitle,
              featured: recognition.isFeatured,
            },
          };
        }),
    [mediaType, organization.nameAr, organization.nameEn, recognitions, result, worksById],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>عرض JSON سريع</CardTitle>
        <CardDescription>
          سجل واحد لكل تكريم، يعرض الاسم الإنجليزي للعمل ومعرّفه وبيانات الجائزة الأساسية فقط.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>نوع العمل</FieldLabel>
            <Select
              items={[
                { value: "all", label: "كل الأنواع" },
                ...mediaTypes.map((kind) => ({ value: kind, label: kind })),
              ]}
              value={mediaType}
              onValueChange={(value) => setMediaType(value ?? "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {mediaTypes.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>النتيجة</FieldLabel>
            <Select
              items={[
                { value: "all", label: "كل النتائج" },
                { value: "winner", label: "الفائزون فقط" },
                { value: "nominee", label: "المرشحون فقط" },
              ]}
              value={result}
              onValueChange={(value) => {
                // SAFETY: `items` above only offers "all"/"winner"/"nominee" — the same union as
                // `result` — so a non-null `value` is always one of them.
                setResult((value ?? "all") as typeof result);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">كل النتائج</SelectItem>
                  <SelectItem value="winner">الفائزون فقط</SelectItem>
                  <SelectItem value="nominee">المرشحون فقط</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <Textarea
          dir="ltr"
          className="max-h-150 ltr overflow-auto rounded-xl border bg-muted/40 p-4 text-start font-mono text-xs leading-5"
        >
          {JSON.stringify(document, null, 2)}
        </Textarea>
      </CardContent>
    </Card>
  );
}

function RecognitionsDesk({
  organization,
  recognitions,
  onChanged,
  onDelete,
}: {
  organization: AwardOrganization;
  recognitions: AwardRecognition[];
  onChanged: () => Promise<void>;
  onDelete: (recognition: AwardRecognition) => void;
}) {
  const [editing, setEditing] = useState<AwardRecognition | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {editing ? "تعديل التكريم" : `إضافة عمل إلى ${organization.nameAr}`}
          </CardTitle>
          <CardDescription>
            اختر العمل والفئة ثم سجّل فوزاً أو ترشيحاً على مستوى العنوان أو جزء محدد.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6">
          <AwardRecognitionForm
            key={editing?.id ?? "new"}
            organizations={[organization]}
            fixedOrganizationId={organization.id}
            recognition={editing}
            onSaved={onChanged}
            onDone={() => setEditing(null)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>كل التكريمات</CardTitle>
          <CardDescription>الفوز والترشيح يشملان الأعمال الخاصة في هذه القائمة.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recognitions.map((recognition) => (
            <div
              key={recognition.id}
              className="flex flex-col gap-3 rounded-2xl border p-3 lg:flex-row lg:items-center"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full bg-muted",
                  recognition.result === "winner" && "bg-primary/50 text-primary-foreground",
                )}
              >
                <TrophyIcon weight={recognition.result === "winner" ? "fill" : "duotone"} />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to="/admin/catalog/$workId"
                  params={{ workId: recognition.titleId }}
                  className="font-medium hover:underline"
                >
                  {recognition.titleAr || recognition.title}
                  {recognition.installmentTitle &&
                  recognition.installmentTitle !== recognition.titleAr ? (
                    <>
                      {" - "} {recognition.installmentTitle}
                    </>
                  ) : null}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {/*<Badge variant={recognition.result === "winner" ? "default" : "secondary"}>
                    {recognition.result === "winner" ? "فائز" : "مرشّح"}
                  </Badge>*/}
                  <Badge variant="outline">{recognition.category}</Badge>
                  {recognition.year ? <Badge variant="outline">{recognition.year}</Badge> : null}
                  {recognition.isPrivate ? (
                    <Badge variant="secondary">
                      <EyeSlashIcon data-icon="inline-start" /> خاص
                    </Badge>
                  ) : null}
                  {recognition.isFeatured ? <Badge>مُبرز</Badge> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(recognition)}>
                  <NotePencilIcon data-icon="inline-start" /> تعديل
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(recognition)}>
                  <TrashIcon data-icon="inline-start" /> حذف التكريم
                </Button>
              </div>
            </div>
          ))}
          {!recognitions.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد أعمال مرتبطة</EmptyTitle>
                <EmptyDescription>استخدم النموذج أعلاه لإضافة أول فوز أو ترشيح.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ slug: "", nameAr: "", nameEn: "", websiteUrl: "" });
  const mutation = useMutation({
    mutationFn: createAwardOrganization,
    onSuccess: async (created) => {
      onOpenChange(false);
      setDraft({ slug: "", nameAr: "", nameEn: "", websiteUrl: "" });
      await onCreated(created.id);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>جهة مانحة جديدة</DialogTitle>
          <DialogDescription>
            ستصبح متاحة لكل الأعمال بعد إضافة فئة واحدة على الأقل.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>الاسم العربي</FieldLabel>
            <Input
              value={draft.nameAr}
              onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>الاسم الإنجليزي</FieldLabel>
            <Input
              dir="ltr"
              value={draft.nameEn}
              onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>المعرّف</FieldLabel>
            <Input
              dir="ltr"
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>الموقع الرسمي</FieldLabel>
            <Input
              type="url"
              dir="ltr"
              value={draft.websiteUrl}
              onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })}
            />
          </Field>
        </FieldGroup>
        <MutationErrorAlert error={mutation.error} />
        <DialogFooter>
          <Button
            disabled={
              mutation.isPending ||
              !draft.nameAr.trim() ||
              !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)
            }
            onClick={() =>
              mutation.mutate({
                data: {
                  slug: draft.slug,
                  nameAr: draft.nameAr,
                  nameEn: draft.nameEn || null,
                  websiteUrl: draft.websiteUrl || null,
                },
              })
            }
          >
            <PlusIcon data-icon="inline-start" /> إضافة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateCategoryDialog({
  organization,
  open,
  onOpenChange,
  onCreated,
}: {
  organization: AwardOrganization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ slug: "", nameAr: "", nameEn: "" });
  const mutation = useMutation({
    mutationFn: createAwardCategory,
    onSuccess: async () => {
      onOpenChange(false);
      setDraft({ slug: "", nameAr: "", nameEn: "" });
      await onCreated();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>فئة جديدة في {organization.nameAr}</DialogTitle>
          <DialogDescription>يمكن استخدام الفئة فوراً عند إضافة فوز أو ترشيح.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>الاسم العربي</FieldLabel>
            <Input
              value={draft.nameAr}
              onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>الاسم الإنجليزي</FieldLabel>
            <Input
              dir="ltr"
              value={draft.nameEn}
              onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>المعرّف</FieldLabel>
            <Input
              dir="ltr"
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
            />
          </Field>
        </FieldGroup>
        <MutationErrorAlert error={mutation.error} />
        <DialogFooter>
          <Button
            disabled={
              mutation.isPending ||
              !draft.nameAr.trim() ||
              !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)
            }
            onClick={() =>
              mutation.mutate({
                data: {
                  organizationId: organization.id,
                  slug: draft.slug,
                  nameAr: draft.nameAr,
                  nameEn: draft.nameEn || null,
                },
              })
            }
          >
            <PlusIcon data-icon="inline-start" /> إضافة الفئة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAwardDialog({
  target,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  target: DeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  error: Error | null;
}) {
  const label =
    target?.kind === "organization"
      ? target.item.nameAr
      : target?.kind === "category"
        ? target.item.nameAr
        : target?.kind === "ceremony"
          ? `حفل ${target.item.year}`
          : target
            ? target.item.titleAr || target.item.title
            : "";
  const affected =
    target?.kind === "organization"
      ? target.item.recognitionCount
      : target?.kind === "category"
        ? target.item.recognitionCount
        : target?.kind === "recognition"
          ? 1
          : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>حذف {label}؟</DialogTitle>
          <DialogDescription>
            {target?.kind === "organization"
              ? "سيُحذف تعريف الجائزة وفئاتها وكل مرات الفوز والترشيح من جميع الأعمال."
              : target?.kind === "category"
                ? "ستُحذف الفئة وكل التكريمات المرتبطة بها من جميع الأعمال."
                : target?.kind === "ceremony"
                  ? "سيُحذف سجل الحفل فقط؛ التكريمات المرتبطة به تبقى كما هي وتفقد ربطها بهذا الحفل تحديداً."
                  : "سيُحذف هذا التكريم فقط من العمل."}
          </DialogDescription>
        </DialogHeader>
        {target?.kind !== "ceremony" ? (
          <Alert variant="destructive">
            <TrashIcon />
            <AlertTitle>سيُحذف {number.format(affected)} تكريم</AlertTitle>
            <AlertDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDescription>
          </Alert>
        ) : null}
        <MutationErrorAlert error={error} />
        <DialogFooter className="flex-row justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            <TrashIcon data-icon="inline-start" /> {pending ? "جارٍ الحذف…" : "تأكيد الحذف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
