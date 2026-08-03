import {
  BuildingsIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AdminEntityInput, Entity } from "@/features/library/model";
import { cn } from "@/lib/utils";
import { saveEntity } from "@/server/library.functions";

type EntityDraft = AdminEntityInput & { identitiesText: string; aliasesText: string };

const entityTypeItems = [
  { value: "person", label: "شخص" },
  { value: "organization", label: "منظمة" },
] as const;

function draftFromEntity(entity?: Entity): EntityDraft {
  return {
    id: entity?.id,
    name: entity?.name ?? "",
    sortName: entity?.sortName ?? "",
    entityType: entity?.entityType ?? "organization",
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

export function EntityManagerDialog({
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
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | Entity["entityType"]>("all");
  const [draft, setDraft] = useState<EntityDraft>(() => draftFromEntity(entities[0]));
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entities.filter(
      (entity) =>
        (type === "all" || entity.entityType === type) &&
        (!query ||
          [entity.name, entity.sortName, ...entity.alternativeNames]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    );
  }, [entities, search, type]);
  const mutation = useMutation({
    mutationFn: saveEntity,
    onSuccess: async (saved) => {
      await onSaved();
      setDraft(draftFromEntity(saved));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const alternativeNames = draft.aliasesText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    const externalIdentities = draft.identitiesText
      .split("\n")
      .map((line) => line.split("|").map((value) => value.trim()))
      .filter(([provider, externalId]) => Boolean(provider && externalId))
      .map(([provider, externalId, url]) => ({ provider, externalId, url: url || null }));
    const { aliasesText: _aliasesText, identitiesText: _identitiesText, ...input } = draft;
    mutation.mutate({ data: { ...input, alternativeNames, externalIdentities } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex h-[min(90dvh,54rem)] min-w-5xl flex-col overflow-hidden p-0"
      >
        <DialogHeader className="border-b p-5 text-right">
          <DialogTitle>إدارة الأشخاص والمنظمات</DialogTitle>
          <DialogDescription>
            عدّل الهوية والصورة والأسماء البديلة والمعرّفات الخارجية لكل جهة في قاعدة البيانات.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 md:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-3 border-b p-4 md:border-e md:border-b-0">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث عن جهة…"
                  className="pe-9"
                  aria-label="البحث في الجهات"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setDraft(draftFromEntity())}
                aria-label="إضافة جهة"
              >
                <PlusIcon />
              </Button>
            </div>
            <ToggleGroup
              value={[type]}
              onValueChange={(values) => {
                const next = values.at(-1) as typeof type | undefined;
                if (next) setType(next);
              }}
              variant="outline"
              spacing={0}
              aria-label="نوع الجهة"
            >
              <ToggleGroupItem value="all">الكل</ToggleGroupItem>
              <ToggleGroupItem value="person">أشخاص</ToggleGroupItem>
              <ToggleGroupItem value="organization">منظمات</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex min-h-32 flex-1 flex-col gap-1 overflow-y-auto pe-1">
              {filtered.map((entity) => {
                const Icon = entity.entityType === "person" ? UsersThreeIcon : BuildingsIcon;
                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => setDraft(draftFromEntity(entity))}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2 text-start transition hover:bg-muted",
                      draft.id === entity.id && "bg-muted",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                      <Icon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" dir="auto">
                        {entity.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{entity.workCount} عمل</span>
                    </span>
                    <Badge variant="outline">
                      {entity.entityType === "person" ? "شخص" : "منظمة"}
                    </Badge>
                  </button>
                );
              })}
              {!filtered.length && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MagnifyingGlassIcon />
                    </EmptyMedia>
                    <EmptyTitle>لا توجد نتائج</EmptyTitle>
                    <EmptyDescription>غيّر البحث أو أنشئ سجلاً جديداً.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </aside>

          <form id="entity-editor-form" onSubmit={submit} className="min-h-0 overflow-y-auto p-5">
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
                  <FieldLabel htmlFor="entity-sort-name">اسم الفرز</FieldLabel>
                  <Input
                    id="entity-sort-name"
                    value={draft.sortName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sortName: event.target.value }))
                    }
                    required
                    dir="auto"
                  />
                </Field>
                <Field>
                  <FieldLabel>النوع</FieldLabel>
                  <Select
                    items={entityTypeItems}
                    value={draft.entityType}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        entityType: (value ?? "organization") as Entity["entityType"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {entityTypeItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="entity-image">مسار صورة الملف</FieldLabel>
                  <Input
                    id="entity-image"
                    value={draft.imagePath ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, imagePath: event.target.value || null }))
                    }
                    placeholder="/media/entities/…"
                    dir="ltr"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="entity-description">النبذة</FieldLabel>
                <Textarea
                  id="entity-description"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={4}
                  dir="auto"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="entity-aliases">الأسماء البديلة</FieldLabel>
                <Textarea
                  id="entity-aliases"
                  value={draft.aliasesText}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, aliasesText: event.target.value }))
                  }
                  placeholder="اسم واحد في كل سطر"
                  rows={3}
                  dir="auto"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="entity-source-provider">مزود المصدر</FieldLabel>
                  <Input
                    id="entity-source-provider"
                    value={draft.sourceProvider ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sourceProvider: event.target.value || null,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="entity-source-url">رابط المصدر</FieldLabel>
                  <Input
                    id="entity-source-url"
                    type="url"
                    value={draft.sourceUrl ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sourceUrl: event.target.value || null }))
                    }
                    dir="ltr"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="entity-established">تاريخ التأسيس / الميلاد</FieldLabel>
                  <Input
                    id="entity-established"
                    value={draft.establishedAt ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        establishedAt: event.target.value || null,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="entity-mal-id">معرّف MyAnimeList</FieldLabel>
                  <Input
                    id="entity-mal-id"
                    type="number"
                    min={1}
                    value={draft.malId ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        malId: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="entity-favorites">عدد المفضلة</FieldLabel>
                  <Input
                    id="entity-favorites"
                    type="number"
                    min={0}
                    value={draft.favorites ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        favorites: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="entity-identities">المعرّفات الخارجية</FieldLabel>
                <Textarea
                  id="entity-identities"
                  value={draft.identitiesText}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, identitiesText: event.target.value }))
                  }
                  placeholder="provider | external id | optional URL"
                  rows={4}
                  dir="ltr"
                />
              </Field>
              {mutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>{mutation.error.message}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </form>
        </div>
        <DialogFooter className="border-t p-4">
          <Button type="submit" form="entity-editor-form" disabled={mutation.isPending}>
            {mutation.isPending ? "جارٍ الحفظ…" : draft.id ? "حفظ الجهة" : "إنشاء الجهة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
