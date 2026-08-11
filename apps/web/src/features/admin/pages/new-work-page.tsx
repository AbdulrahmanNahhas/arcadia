"use client";

import {
  CheckCircleIcon,
  ListPlusIcon,
  PlusIcon,
  RowsPlusBottomIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { kindLabels, personalStatuses } from "@/features/library/filtering";
import type { Genre, Work, WorkKind } from "@/features/library/model";
import { genreSchema, workKinds } from "@/features/library/model";
import { statusLabelsAr } from "@/features/library/translations";
import { addWorksBulk } from "@/server/library.functions";

type AddMode = "guided" | "paste";

type NewWork = {
  title: string;
  kind: WorkKind;
  year: number | null;
  status: Work["status"];
  isPrivate: boolean;
  summary: string;
  genres: Genre[];
  tags: string[];
  studios: string[];
};

type ParseResult = {
  works: NewWork[];
  errors: string[];
};

const addModeItems = [
  { value: "guided", label: "عمل واحد — نموذج موجّه" },
  { value: "paste", label: "أعمال متعددة — لصق منظّم" },
] as const;
const mediaKinds = workKinds.filter((value) => ["movie", "series", "anime"].includes(value));
const kindItems = mediaKinds.map((value) => ({ value, label: kindLabels[value] }));
const statusItems = personalStatuses.map((value) => ({ value, label: statusLabelsAr[value] }));

const pasteExample = `Frieren: Beyond Journey's End | anime | 2023 | planned | Adventure, Fantasy | Madhouse
Pluto | anime | 2023 | completed | Mystery, Science Fiction | Studio M2`;

function parseList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function parsePastedWorks(value: string): ParseResult {
  const works: NewWork[] = [];
  const errors: string[] = [];

  value.split("\n").forEach((line, index) => {
    if (!line.trim()) return;
    const [
      title,
      rawKind = "anime",
      rawYear = "",
      rawStatus = "saved",
      rawGenres = "",
      rawStudios = "",
      rawPrivate = "false",
    ] = line.split("|").map((part) => part.trim());
    const lineErrors: string[] = [];
    if (!title) lineErrors.push("العنوان مطلوب");
    if (!mediaKinds.includes(rawKind as WorkKind)) lineErrors.push(`النوع «${rawKind}» غير معروف`);
    if (!personalStatuses.includes(rawStatus as Work["status"])) {
      lineErrors.push(`الحالة «${rawStatus}» غير معروفة`);
    }
    const isPrivate = ["true", "private", "خاص", "yes", "1"].includes(
      rawPrivate.toLocaleLowerCase(),
    );
    const year = rawYear ? Number(rawYear) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 2200)) {
      lineErrors.push("السنة يجب أن تكون بين 1000 و2200");
    }
    const genres = parseList(rawGenres).flatMap((genre) => {
      const result = genreSchema.safeParse(genre);
      if (result.success) return [result.data];
      lineErrors.push(`التصنيف «${genre}» غير معروف`);
      return [];
    });
    if (lineErrors.length) {
      errors.push(`السطر ${index + 1}: ${lineErrors.join("، ")}`);
      return;
    }
    works.push({
      title,
      kind: rawKind as WorkKind,
      year,
      status: rawStatus as Work["status"],
      isPrivate,
      summary: "",
      genres,
      tags: [],
      studios: parseList(rawStudios),
    });
  });

  return { works, errors };
}

export function AdminNewWorkPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AddMode>("guided");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<WorkKind>("movie");
  const [status, setStatus] = useState<Work["status"]>("saved");
  const [year, setYear] = useState("");
  const [summary, setSummary] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [genres, setGenres] = useState("");
  const [studios, setStudios] = useState("");
  const [rows, setRows] = useState(pasteExample);
  const [formError, setFormError] = useState("");
  const parsed = useMemo(() => parsePastedWorks(rows), [rows]);
  const mutation = useMutation({
    mutationFn: addWorksBulk,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["works"] });
      await navigate({ to: "/admin/catalog" });
    },
  });

  const submit = () => {
    if (mode === "paste") {
      if (parsed.errors.length || !parsed.works.length) {
        setFormError(parsed.errors[0] ?? "أضف سطراً صالحاً واحداً على الأقل قبل الحفظ.");
        return;
      }
      setFormError("");
      mutation.mutate({ data: { works: parsed.works } });
      return;
    }

    if (!title.trim()) {
      setFormError("أدخل عنوان العمل.");
      return;
    }
    const parsedGenres = parseList(genres).flatMap((genre) => {
      const result = genreSchema.safeParse(genre);
      return result.success ? [result.data] : [];
    });
    if (parsedGenres.length !== parseList(genres).length) {
      setFormError("يوجد تصنيف غير مسجل في القاموس. صححه أو أضفه إلى قاموس التصنيفات أولاً.");
      return;
    }
    setFormError("");
    mutation.mutate({
      data: {
        works: [
          {
            title: title.trim(),
            kind,
            year: year ? Number(year) : null,
            status,
            isPrivate,
            summary: summary.trim(),
            genres: parsedGenres,
            tags: [],
            studios: parseList(studios),
          },
        ],
      },
    });
  };

  const error = formError || mutation.error?.message;

  return (
    <div
      dir="rtl"
      className="mx-auto flex w-full max-w-3xl mb-4  flex-col overflow-hidden rounded-xl border bg-card"
    >
      <header className="border-b p-5 text-right">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ListPlusIcon weight="duotone" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">إضافة أعمال إلى المكتبة</h1>
            <p className="text-sm text-muted-foreground">
              استخدم النموذج الموجّه لسجل واحد أو الصق قائمة كاملة في المكان نفسه.
            </p>
          </div>
        </div>
      </header>

      <main className="p-5">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="add-mode">طريقة الإضافة</FieldLabel>
            <Select
              items={addModeItems}
              value={mode}
              onValueChange={(value) => {
                if (value) setMode(value);
                setFormError("");
              }}
            >
              <SelectTrigger id="add-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="guided">
                    <PlusIcon />
                    عمل واحد — نموذج موجّه
                  </SelectItem>
                  <SelectItem value="paste">
                    <RowsPlusBottomIcon />
                    أعمال متعددة — لصق منظّم
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {mode === "guided" ? (
            <>
              <Field data-invalid={Boolean(formError && !title.trim())}>
                <FieldLabel htmlFor="new-work-title">العنوان</FieldLabel>
                <Input
                  id="new-work-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="اسم العمل كما سيظهر في المكتبة"
                  autoFocus
                  aria-invalid={Boolean(formError && !title.trim())}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="new-work-kind">النوع</FieldLabel>
                  <Select
                    items={kindItems}
                    value={kind}
                    onValueChange={(value) => value && setKind(value)}
                  >
                    <SelectTrigger id="new-work-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {mediaKinds.map((item) => (
                          <SelectItem key={item} value={item}>
                            {kindLabels[item]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-work-status">الحالة</FieldLabel>
                  <Select
                    items={statusItems}
                    value={status}
                    onValueChange={(value) => value && setStatus(value)}
                  >
                    <SelectTrigger id="new-work-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {personalStatuses.map((item) => (
                          <SelectItem key={item} value={item}>
                            {statusLabelsAr[item]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-work-year">السنة</FieldLabel>
                  <Input
                    id="new-work-year"
                    type="number"
                    min={1000}
                    max={2200}
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    placeholder="2026"
                  />
                </Field>
              </div>
              <Field orientation="horizontal">
                <Switch id="new-work-private" checked={isPrivate} onCheckedChange={setIsPrivate} />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="new-work-private">عمل خاص</FieldLabel>
                  <FieldDescription>
                    يُحفظ في الإدارة وقاعدة البيانات ولا يظهر في المنصة.
                  </FieldDescription>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-work-genres">التصنيفات</FieldLabel>
                <Input
                  id="new-work-genres"
                  value={genres}
                  onChange={(event) => setGenres(event.target.value)}
                  placeholder="Drama, Fantasy"
                  dir="ltr"
                />
                <FieldDescription>
                  افصل القيم بفواصل. تُقبل التصنيفات الموجودة في القاموس فقط.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-work-studios">الاستوديوهات أو الناشرون</FieldLabel>
                <Input
                  id="new-work-studios"
                  value={studios}
                  onChange={(event) => setStudios(event.target.value)}
                  placeholder="Madhouse, Kadokawa"
                  dir="ltr"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-work-summary">الملخص</FieldLabel>
                <Textarea
                  id="new-work-summary"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="ملخص قصير قابل للبحث…"
                  rows={4}
                />
              </Field>
            </>
          ) : (
            <>
              <Alert>
                <RowsPlusBottomIcon />
                <AlertTitle>عمود واحد لكل قيمة</AlertTitle>
                <AlertDescription>
                  العنوان | النوع | السنة | الحالة | التصنيفات | الاستوديوهات | خاص (اختياري). افصل
                  القيم داخل العمود بفواصل.
                </AlertDescription>
              </Alert>
              <Field data-invalid={parsed.errors.length > 0}>
                <FieldLabel htmlFor="pasted-works">قائمة الأعمال</FieldLabel>
                <Textarea
                  id="pasted-works"
                  value={rows}
                  onChange={(event) => setRows(event.target.value)}
                  className="min-h-72 resize-y font-mono text-xs leading-6"
                  dir="ltr"
                  spellCheck={false}
                  aria-invalid={parsed.errors.length > 0}
                />
                <FieldDescription>
                  الأنواع المتاحة: {mediaKinds.join(", ")}. الحالات المتاحة:{" "}
                  {personalStatuses.join(", ")}.
                </FieldDescription>
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <CheckCircleIcon data-icon="inline-start" />
                  {parsed.works.length} صالح
                </Badge>
                {parsed.errors.length > 0 && (
                  <Badge variant="destructive">
                    <WarningCircleIcon data-icon="inline-start" />
                    {parsed.errors.length} يحتاج تصحيحاً
                  </Badge>
                )}
              </div>
              {parsed.errors.length > 0 && (
                <Alert variant="destructive">
                  <WarningCircleIcon />
                  <AlertTitle>صحّح الأسطر قبل الإضافة</AlertTitle>
                  <AlertDescription>
                    <ul className="flex list-disc flex-col gap-1 ps-4">
                      {parsed.errors.slice(0, 6).map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
          {error && (
            <Alert variant="destructive">
              <WarningCircleIcon />
              <AlertTitle>لم تُضف الأعمال</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </main>

      <footer className="flex justify-end gap-2 border-t p-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/admin/catalog" })}
          disabled={mutation.isPending}
        >
          إلغاء
        </Button>
        <Button type="button" onClick={submit} disabled={mutation.isPending}>
          <PlusIcon data-icon="inline-start" />
          {mutation.isPending
            ? "جارٍ الإضافة…"
            : mode === "paste"
              ? `إضافة ${parsed.works.length} عمل`
              : "إضافة العمل"}
        </Button>
      </footer>
    </div>
  );
}
