import type { AwardOrganizationOption, AwardRecognition } from "@arcadia/contracts";
import { ar } from "@arcadia/i18n";
import { PlusIcon, TrashIcon, TrophyIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WorkStructure } from "@/features/library/model";
import {
  createAwardCategory,
  createAwardOrganization,
  getAwardOptions,
} from "@/server/library.functions";

const awardsKey = ["admin", "awards", "options"] as const;

function createRecognition(program?: AwardOrganizationOption): AwardRecognition {
  return {
    id: crypto.randomUUID(),
    organizationSlug: program?.slug ?? "",
    organizationName: program?.nameAr ?? "",
    category: program?.categories[0]?.nameAr ?? "",
    year: new Date().getFullYear(),
    result: "nominee",
    isFeatured: false,
    installmentId: null,
    installmentTitle: null,
    sourceUrl: null,
    notes: null,
  };
}

export function AwardField({
  value,
  onChange,
  structure,
}: {
  value: AwardRecognition[];
  onChange: (value: AwardRecognition[]) => void;
  structure?: WorkStructure;
}) {
  const options = useQuery({ queryKey: awardsKey, queryFn: getAwardOptions });
  const programs = options.data ?? [];
  const update = (index: number, next: AwardRecognition) =>
    onChange(value.map((recognition, current) => (current === index ? next : recognition)));

  return (
    <div className="flex flex-col gap-4">
      {value.length === 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>لا توجد جوائز مسجّلة</CardTitle>
            <CardDescription>
              أضف فوزًا أو ترشيحًا واربطه بالعنوان كاملًا أو بجزء محدد.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange([createRecognition(programs[0])])}
            >
              <PlusIcon data-icon="inline-start" />
              إضافة أول جائزة
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {value.map((recognition, index) => (
        <Card key={recognition.id} size="sm">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <TrophyIcon weight={recognition.result === "winner" ? "fill" : "duotone"} />
              </span>
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">
                  {recognition.organizationName || "جائزة جديدة"}
                </CardTitle>
                <CardDescription className="truncate">
                  {recognition.category || "اختر الفئة"}
                </CardDescription>
              </div>
            </div>
            <Badge variant={recognition.result === "winner" ? "default" : "secondary"}>
              {recognition.result === "winner" ? ar.awards.winner : ar.awards.nominee}
            </Badge>
          </CardHeader>

          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <AwardVocabularyFields
                  recognition={recognition}
                  programs={programs}
                  onChange={(next) => update(index, next)}
                />

                <Field>
                  <FieldLabel>النتيجة</FieldLabel>
                  <ToggleGroup
                    multiple={false}
                    value={[recognition.result]}
                    variant="outline"
                    className="w-full"
                    onValueChange={(results) => {
                      const result = results[0] as AwardRecognition["result"] | undefined;
                      if (result) update(index, { ...recognition, result });
                    }}
                  >
                    <ToggleGroupItem value="winner" className="flex-1">
                      {ar.awards.winner}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="nominee" className="flex-1">
                      {ar.awards.nominee}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                <Field>
                  <FieldLabel>النطاق</FieldLabel>
                  <Select
                    value={recognition.installmentId ?? "title"}
                    onValueChange={(target) => {
                      const installment = structure?.seasons.find((item) => item.id === target);
                      update(index, {
                        ...recognition,
                        installmentId: installment?.id ?? null,
                        installmentTitle: installment?.title ?? null,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر النطاق" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="title">العنوان كاملًا</SelectItem>
                        {structure?.seasons.map((installment) => (
                          <SelectItem key={installment.id} value={installment.id}>
                            {installment.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor={`award-year-${recognition.id}`}>السنة</FieldLabel>
                  <Input
                    id={`award-year-${recognition.id}`}
                    type="number"
                    min="1900"
                    max="2100"
                    value={recognition.year ?? ""}
                    onChange={(event) =>
                      update(index, {
                        ...recognition,
                        year: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </Field>

                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <div className="flex-1">
                    <FieldLabel htmlFor={`award-featured-${recognition.id}`}>
                      إبراز في واجهة العنوان
                    </FieldLabel>
                    <FieldDescription>يعرض هذا التكريم في شارة البطل.</FieldDescription>
                  </div>
                  <Switch
                    id={`award-featured-${recognition.id}`}
                    checked={recognition.isFeatured}
                    onCheckedChange={(isFeatured) =>
                      onChange(
                        value.map((item, current) => ({
                          ...item,
                          isFeatured: current === index ? isFeatured : false,
                        })),
                      )
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`award-source-${recognition.id}`}>رابط المصدر</FieldLabel>
                  <Input
                    id={`award-source-${recognition.id}`}
                    type="url"
                    dir="ltr"
                    value={recognition.sourceUrl ?? ""}
                    placeholder="https://"
                    onChange={(event) =>
                      update(index, {
                        ...recognition,
                        sourceUrl: event.target.value || null,
                      })
                    }
                  />
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel htmlFor={`award-notes-${recognition.id}`}>ملاحظات</FieldLabel>
                  <Textarea
                    id={`award-notes-${recognition.id}`}
                    value={recognition.notes ?? ""}
                    rows={2}
                    onChange={(event) =>
                      update(index, { ...recognition, notes: event.target.value || null })
                    }
                  />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>

          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((_, current) => current !== index))}
            >
              <TrashIcon data-icon="inline-start" />
              حذف التكريم
            </Button>
          </CardFooter>
        </Card>
      ))}

      {value.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onChange([...value, createRecognition(programs[0])])}
        >
          <PlusIcon data-icon="inline-start" />
          إضافة جائزة أو ترشيح
        </Button>
      ) : null}
    </div>
  );
}

function AwardVocabularyFields({
  recognition,
  programs,
  onChange,
}: {
  recognition: AwardRecognition;
  programs: AwardOrganizationOption[];
  onChange: (recognition: AwardRecognition) => void;
}) {
  const queryClient = useQueryClient();
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [organization, setOrganization] = useState({ slug: "", nameAr: "" });
  const [category, setCategory] = useState({ slug: "", nameAr: "" });
  const program = programs.find((candidate) => candidate.slug === recognition.organizationSlug);
  const addOrganization = useMutation({
    mutationFn: createAwardOrganization,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: awardsKey });
      onChange({
        ...recognition,
        organizationSlug: created.slug,
        organizationName: created.nameAr,
        category: "",
      });
      setOrganizationOpen(false);
      setOrganization({ slug: "", nameAr: "" });
    },
  });
  const addCategory = useMutation({
    mutationFn: createAwardCategory,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: awardsKey });
      onChange({ ...recognition, category: created.nameAr });
      setCategoryOpen(false);
      setCategory({ slug: "", nameAr: "" });
    },
  });

  return (
    <>
      <Field>
        <FieldLabel>{ar.awards.organization}</FieldLabel>
        <Select
          value={recognition.organizationSlug || null}
          onValueChange={(slug) => {
            const selected = programs.find((candidate) => candidate.slug === slug);
            if (!selected) return;
            onChange({
              ...recognition,
              organizationSlug: selected.slug,
              organizationName: selected.nameAr,
              category: selected.categories[0]?.nameAr ?? "",
            });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="اختر الجهة" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {programs.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.slug}>
                  {candidate.nameAr}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOrganizationOpen(true)}>
          <PlusIcon data-icon="inline-start" /> {ar.awards.addOrganization}
        </Button>
      </Field>

      <Field>
        <FieldLabel>{ar.awards.category}</FieldLabel>
        <Select
          value={recognition.category || null}
          disabled={!program}
          onValueChange={(nameAr) => onChange({ ...recognition, category: nameAr ?? "" })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="اختر الفئة" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {program?.categories.map((item) => (
                <SelectItem key={item.id} value={item.nameAr}>
                  {item.nameAr}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!program}
          onClick={() => setCategoryOpen(true)}
        >
          <PlusIcon data-icon="inline-start" /> {ar.awards.addCategory}
        </Button>
      </Field>

      <VocabularyDialog
        open={organizationOpen}
        onOpenChange={setOrganizationOpen}
        title={ar.awards.addOrganization}
        description="تُحفظ الجهة مرة واحدة وتصبح متاحة لكل الأعمال."
        value={organization}
        onChange={setOrganization}
        pending={addOrganization.isPending}
        onSubmit={() =>
          addOrganization.mutate({
            data: { ...organization, nameEn: null, websiteUrl: null },
          })
        }
      />
      <VocabularyDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title={ar.awards.addCategory}
        description={`أضف فئة جديدة إلى ${program?.nameAr ?? "الجهة المحددة"}.`}
        value={category}
        onChange={setCategory}
        pending={addCategory.isPending}
        onSubmit={() => {
          if (!program) return;
          addCategory.mutate({
            data: { organizationId: program.id, ...category, nameEn: null },
          });
        }}
      />
    </>
  );
}

function VocabularyDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  value: { slug: string; nameAr: string };
  onChange: (value: { slug: string; nameAr: string }) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${title}-name`}>الاسم العربي</FieldLabel>
            <Input
              id={`${title}-name`}
              value={value.nameAr}
              onChange={(event) => onChange({ ...value, nameAr: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${title}-slug`}>المعرّف اللاتيني</FieldLabel>
            <Input
              id={`${title}-slug`}
              dir="ltr"
              placeholder="example-award"
              value={value.slug}
              onChange={(event) => onChange({ ...value, slug: event.target.value })}
            />
            <FieldDescription>أحرف لاتينية صغيرة وأرقام وشرطات فقط.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={
              pending || !value.nameAr.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)
            }
          >
            {pending ? ar.common.loading : ar.common.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
