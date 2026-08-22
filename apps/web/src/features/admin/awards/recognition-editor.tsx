import type {
  AdminAwardRecognitionInput,
  AdminAwardsDocument,
  AwardOrganizationOption,
} from "@arcadia/contracts";
import { EyeSlashIcon, FloppyDiskIcon, PlusIcon } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getAdminWorkStructure,
  saveAwardRecognition,
  searchAdminWorks,
} from "@/server/library.functions";
import { MutationErrorAlert } from "../components/mutation-error-alert";

export type AdminAwardRecognition = AdminAwardsDocument["recognitions"][number];

/**
 * The one recognition add/edit form — shared between the standalone Awards management page
 * (organization fixed, work picked via search) and the title editor's Awards tab (title fixed,
 * organization picked). Always saves immediately via `saveAwardRecognition`, never staged in a
 * parent draft — this is what makes awards editing a single system regardless of where it's
 * entered from.
 */
export function AwardRecognitionForm({
  organizations,
  recognition,
  fixedTitle,
  fixedOrganizationId,
  onSaved,
  onDone,
}: {
  organizations: AwardOrganizationOption[];
  recognition: AdminAwardRecognition | null;
  /** When set, the work/title picker is hidden and this title is used instead. */
  fixedTitle?: { id: string; label: string };
  /** When set, the organization picker is hidden and this organization is used instead. */
  fixedOrganizationId?: string;
  onSaved: () => Promise<void> | void;
  onDone: () => void;
}) {
  const [workId, setWorkId] = useState(fixedTitle?.id ?? recognition?.titleId ?? "");
  const [selectedWorkLabel, setSelectedWorkLabel] = useState(
    fixedTitle?.label ?? (recognition ? recognition.titleAr || recognition.title : ""),
  );
  const [organizationId, setOrganizationId] = useState(
    fixedOrganizationId ?? recognition?.organizationId ?? organizations[0]?.id ?? "",
  );
  const organization = organizations.find((item) => item.id === organizationId);
  const [categoryId, setCategoryId] = useState(
    recognition?.categoryId ?? organization?.categories[0]?.id ?? "",
  );
  const [installmentId, setInstallmentId] = useState<string | null>(
    recognition?.installmentId ?? null,
  );
  const [result, setResult] = useState<"winner" | "nominee">(recognition?.result ?? "nominee");
  const [year, setYear] = useState<number | null>(recognition?.year ?? new Date().getFullYear());
  const [isFeatured, setIsFeatured] = useState(recognition?.isFeatured ?? false);
  const [sourceUrl, setSourceUrl] = useState(recognition?.sourceUrl ?? "");
  const [notes, setNotes] = useState(recognition?.notes ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const search = useQuery({
    queryKey: ["admin-work-search", debouncedQuery],
    queryFn: () => searchAdminWorks({ data: { q: debouncedQuery, limit: 20 } }),
    enabled: !fixedTitle,
  });
  const structure = useQuery({
    queryKey: ["admin-work-structure", workId],
    queryFn: () => getAdminWorkStructure({ data: { workId } }),
    enabled: Boolean(workId),
  });
  const mutation = useMutation({
    mutationFn: saveAwardRecognition,
    onSuccess: async () => {
      if (!fixedTitle) {
        setWorkId("");
        setSelectedWorkLabel("");
      }
      setInstallmentId(null);
      setResult("nominee");
      setIsFeatured(false);
      setSourceUrl("");
      setNotes("");
      onDone();
      await onSaved();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const data: AdminAwardRecognitionInput = {
      id: recognition?.id,
      organizationId,
      categoryId,
      titleId: workId,
      installmentId,
      year,
      result,
      isFeatured,
      sourceUrl: sourceUrl || null,
      notes: notes || null,
    };
    mutation.mutate({ data });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div
        className={
          fixedTitle
            ? "grid gap-5"
            : "grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"
        }
      >
        {!fixedTitle ? (
          <Command className="h-80 rounded-2xl border" shouldFilter={false}>
            <CommandInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="ابحث بالاسم العربي أو الإنجليزي…"
            />
            <CommandList>
              <CommandEmpty>{search.isFetching ? "يبحث…" : "لا يوجد عمل مطابق."}</CommandEmpty>
              <CommandGroup heading="الأعمال">
                {(search.data ?? []).map((work) => (
                  <CommandItem
                    key={work.id}
                    value={work.id}
                    data-checked={workId === work.id}
                    onSelect={() => {
                      setWorkId(work.id);
                      setSelectedWorkLabel(work.arabicTitle || work.title);
                      setInstallmentId(null);
                    }}
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
        ) : null}
        <FieldGroup>
          {!fixedTitle ? (
            <Field>
              <FieldLabel>العمل المحدد</FieldLabel>
              <div className="rounded-xl border p-3 text-sm">
                {selectedWorkLabel || "لم يُحدد عمل"}
              </div>
            </Field>
          ) : null}
          {!fixedOrganizationId ? (
            <Field>
              <FieldLabel>الجهة المانحة</FieldLabel>
              <Select
                items={organizations.map((item) => ({ value: item.id, label: item.nameAr }))}
                value={organizationId}
                onValueChange={(value) => {
                  if (!value) return;
                  setOrganizationId(value);
                  const next = organizations.find((item) => item.id === value);
                  setCategoryId(next?.categories[0]?.id ?? "");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الجهة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {organizations.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nameAr}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field>
            <FieldLabel>الفئة</FieldLabel>
            <Select
              items={(organization?.categories ?? []).map((category) => ({
                value: category.id,
                label: category.nameAr,
              }))}
              value={categoryId}
              onValueChange={(value) => setCategoryId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(organization?.categories ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.nameAr}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>النطاق</FieldLabel>
            <Select
              value={installmentId ?? "title"}
              onValueChange={(value) =>
                setInstallmentId(value === "title" ? null : (value ?? null))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="title">العنوان كاملًا</SelectItem>
                  {structure.data?.seasons.map((installment) => (
                    <SelectItem key={installment.id} value={installment.id}>
                      {installment.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>النتيجة</FieldLabel>
            <ToggleGroup
              multiple={false}
              value={[result]}
              variant="outline"
              className="w-full"
              onValueChange={(values) => {
                if (!values[0]) return;
                // SAFETY: the `ToggleGroupItem`s below only offer "winner"/"nominee".
                setResult(values[0] as "winner" | "nominee");
              }}
            >
              <ToggleGroupItem value="winner" className="flex-1">
                فائز
              </ToggleGroupItem>
              <ToggleGroupItem value="nominee" className="flex-1">
                مرشّح
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel>السنة</FieldLabel>
            <Input
              type="number"
              min="1900"
              max="2100"
              value={year ?? ""}
              onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}
            />
          </Field>
          <Field orientation="horizontal">
            <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
            <div>
              <FieldLabel>إبراز في صفحة العمل</FieldLabel>
              <FieldDescription>يلغي إبراز أي تكريم آخر للعمل نفسه.</FieldDescription>
            </div>
          </Field>
          <Field>
            <FieldLabel>رابط المصدر</FieldLabel>
            <Input
              type="url"
              dir="ltr"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>ملاحظات</FieldLabel>
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </FieldGroup>
      </div>
      <div className="flex items-center justify-end gap-2">
        {recognition ? (
          <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
            إلغاء التعديل
          </Button>
        ) : null}
        <Button type="submit" disabled={!workId || !categoryId || mutation.isPending}>
          {recognition ? (
            <FloppyDiskIcon data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}{" "}
          {mutation.isPending ? "جارٍ الحفظ…" : recognition ? "حفظ التكريم" : "إضافة التكريم"}
        </Button>
      </div>
      <MutationErrorAlert error={mutation.error} />
    </form>
  );
}
