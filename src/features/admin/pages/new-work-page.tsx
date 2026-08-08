import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { Work } from "@/features/library/model";
import { addWork } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const kinds = [
  "movie",
  "series",
  "anime",
  "game",
  "novel",
  "manga",
  "visual-novel",
  "comic",
] as const;

export function AdminNewWorkPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Work["kind"]>("movie");
  const [year, setYear] = useState("");
  const [summary, setSummary] = useState("");
  const mutation = useMutation({
    mutationFn: addWork,
    onSuccess: async (work) => {
      await queryClient.invalidateQueries({ queryKey: ["works"] });
      await navigate({ to: "/admin/catalog/$workId", params: { workId: work.id } });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      data: { title, kind, year: year ? Number(year) : null, summary, status: "saved" },
    });
  };
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        title="إضافة عمل"
        description="أنشئ السجل الأساسي أولاً، ثم أكمل بياناته في صفحة التحرير الكاملة."
      />
      <Card>
        <form onSubmit={submit}>
          <CardHeader>
            <CardTitle>هوية العمل</CardTitle>
            <CardDescription>المعرّف الداخلي يُنشأ تلقائياً ولا يعتمد على العنوان.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-work-title">العنوان</FieldLabel>
                <Input
                  id="new-work-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-work-kind">النوع</FieldLabel>
                <Select
                  items={kinds.map((value) => ({ value, label: value }))}
                  value={kind}
                  onValueChange={(value) => value && setKind(value)}
                >
                  <SelectTrigger id="new-work-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {kinds.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-work-year">سنة الإصدار</FieldLabel>
                <Input
                  id="new-work-year"
                  type="number"
                  min={1800}
                  max={2200}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-work-summary">الملخص</FieldLabel>
                <Textarea
                  id="new-work-summary"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  rows={5}
                />
              </Field>
              {mutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>{mutation.error.message}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "جارٍ الإنشاء…" : "إنشاء ومتابعة التحرير"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
