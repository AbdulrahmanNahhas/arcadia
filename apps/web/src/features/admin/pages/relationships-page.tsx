import { ArrowUpLeftIcon, PlusIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createOrganizationRelationship,
  getOrganizationRelationshipEditorData,
  getStudioLineage,
} from "@/server/platform.functions";
import { AdminPageHeader } from "../components/admin-page-header";

type RelationshipDraft = {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipTypeId: string;
  occurredOn: string;
  datePrecision: "day" | "month" | "year" | "unknown";
  description: string;
  notes: string;
  prominence: number;
  people: Record<string, boolean>;
};

function createDraft(): RelationshipDraft {
  return {
    sourceEntityId: "",
    targetEntityId: "",
    relationshipTypeId: "",
    occurredOn: "",
    datePrecision: "unknown",
    description: "",
    notes: "",
    prominence: 1,
    people: {},
  };
}

export function RelationshipsPage() {
  const queryClient = useQueryClient();
  const { data: relationships } = useSuspenseQuery({
    queryKey: ["studio-lineage"],
    queryFn: () => getStudioLineage(),
  });
  const { data: editorData } = useSuspenseQuery({
    queryKey: ["organization-relationship-editor-data"],
    queryFn: () => getOrganizationRelationshipEditorData(),
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draft, setDraft] = useState<RelationshipDraft>(createDraft);
  const organizations = useMemo(
    () => editorData.entities.filter((entity) => entity.entityType === "organization"),
    [editorData.entities],
  );
  const people = useMemo(
    () => editorData.entities.filter((entity) => entity.entityType === "person"),
    [editorData.entities],
  );
  const selectedType = editorData.types.find((type) => type.id === draft.relationshipTypeId);
  const source = organizations.find((entity) => entity.id === draft.sourceEntityId);
  const target = organizations.find((entity) => entity.id === draft.targetEntityId);
  const mutation = useMutation({
    mutationFn: createOrganizationRelationship,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["studio-lineage"] });
      setIsDialogOpen(false);
      setDraft(createDraft());
    },
  });

  const openCreateDialog = () => {
    setDraft(createDraft());
    mutation.reset();
    setIsDialogOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      data: {
        ...draft,
        occurredOn: draft.occurredOn || null,
        people: Object.entries(draft.people)
          .filter(([, selected]) => selected)
          .map(([entityId]) => ({ entityId, role: "participant" })),
      },
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="العلاقات والسلالة"
        description="سجلات العلاقات المؤسسية المطبّعة التي تغذّي الخط الزمني وخريطة المعرفة."
        actions={
          <>
            <Button
              onClick={openCreateDialog}
              disabled={!organizations.length || !editorData.types.length}
            >
              <PlusIcon data-icon="inline-start" /> إضافة علاقة
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link to="/lineage" />}>
              <ArrowUpLeftIcon data-icon="inline-start" /> معاينة الخط الزمني
            </Button>
          </>
        }
      />
      <Card className="m-6 mt-0 mr-4">
        <CardHeader>
          <CardTitle>العلاقات المؤسسية</CardTitle>
          <CardDescription>
            {relationships.length} علاقة موثقة؛ الأشخاص المرتبطون يظهرون على الحافة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {relationships.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المصدر</TableHead>
                  <TableHead>العلاقة</TableHead>
                  <TableHead>الهدف</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الأشخاص</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationships.map((relation) => (
                  <TableRow key={relation.id}>
                    <TableCell className="font-medium">{relation.source.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{relation.type.nameAr}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{relation.target.name}</TableCell>
                    <TableCell>{relation.occurredOn || "—"}</TableCell>
                    <TableCell>
                      {relation.people.map((person) => person.entity.name).join("، ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد علاقات مؤسسية بعد</EmptyTitle>
                <EmptyDescription>
                  أضف أول علاقة موثقة بين استوديوهين أو منظمتين من الزر أعلاه.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>إضافة علاقة مؤسسية</DialogTitle>
            <DialogDescription>
              اربط منظمتين فقط. تُحفظ المعلومات كحقيقة موثقة، ولن يسمح النظام بالتكرار أو العلاقات
              الدائرية المحظورة.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>المصدر</FieldLabel>
                  <Select
                    value={draft.sourceEntityId}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, sourceEntityId: value ?? "" }))
                    }
                  >
                    <SelectTrigger
                      aria-invalid={Boolean(
                        draft.targetEntityId && draft.sourceEntityId === draft.targetEntityId,
                      )}
                      className="w-full"
                    >
                      <SelectValue placeholder="اختر الاستوديو أو المنظمة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {organizations.map((entity) => (
                          <SelectItem key={entity.id} value={entity.id}>
                            {entity.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  data-invalid={Boolean(
                    draft.targetEntityId && draft.sourceEntityId === draft.targetEntityId,
                  )}
                >
                  <FieldLabel>الهدف</FieldLabel>
                  <Select
                    value={draft.targetEntityId}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, targetEntityId: value ?? "" }))
                    }
                  >
                    <SelectTrigger
                      aria-invalid={Boolean(
                        draft.targetEntityId && draft.sourceEntityId === draft.targetEntityId,
                      )}
                      className="w-full"
                    >
                      <SelectValue placeholder="اختر الاستوديو أو المنظمة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {organizations
                          .filter((entity) => entity.id !== draft.sourceEntityId)
                          .map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>
                              {entity.name}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {draft.targetEntityId && draft.sourceEntityId === draft.targetEntityId ? (
                    <FieldDescription>يجب أن يختلف المصدر والهدف.</FieldDescription>
                  ) : null}
                </Field>
              </div>
              <Field>
                <FieldLabel>نوع العلاقة</FieldLabel>
                <Select
                  value={draft.relationshipTypeId}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, relationshipTypeId: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر النوع الموثق" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {editorData.types.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.nameAr}
                          {type.inverseNameAr ? ` / ${type.inverseNameAr}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {selectedType ? (
                  <FieldDescription>
                    {selectedType.isDirected ? "علاقة اتجاهية" : "علاقة متبادلة"}
                    {selectedType.isDirected && !selectedType.allowsCycles
                      ? "؛ لا يسمح بتكوين حلقة."
                      : "."}
                  </FieldDescription>
                ) : null}
              </Field>
              {source && target && selectedType ? (
                <Alert>
                  <AlertDescription>
                    سيُسجّل: <strong>{source.name}</strong> — <strong>{selectedType.nameAr}</strong> →{" "}
                    <strong>{target.name}</strong>.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>دقة التاريخ</FieldLabel>
                  <Select
                    value={draft.datePrecision}
                    onValueChange={(value) =>
                      setDraft((current) => {
                        // SAFETY: the `SelectItem`s below only offer "unknown"/"year"/"month"/
                        // "day" — the same union as `RelationshipDraft["datePrecision"]`.
                        const datePrecision = (value ??
                          "unknown") as RelationshipDraft["datePrecision"];
                        return {
                          ...current,
                          datePrecision,
                          occurredOn: value === "unknown" ? "" : current.occurredOn,
                        };
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="unknown">غير معروف</SelectItem>
                        <SelectItem value="year">سنة</SelectItem>
                        <SelectItem value="month">شهر</SelectItem>
                        <SelectItem value="day">يوم</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="relationship-date">التاريخ</FieldLabel>
                  <Input
                    id="relationship-date"
                    value={draft.occurredOn}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, occurredOn: event.target.value }))
                    }
                    placeholder={
                      draft.datePrecision === "year"
                        ? "2020"
                        : draft.datePrecision === "month"
                          ? "2020-04"
                          : "2020-04-01"
                    }
                    disabled={draft.datePrecision === "unknown"}
                    required={draft.datePrecision !== "unknown"}
                    dir="ltr"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="relationship-description">سبب التوثيق</FieldLabel>
                <Textarea
                  id="relationship-description"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="اشرح العلاقة أو اذكر مصدرها بما يكفي لمراجعتها لاحقاً."
                  rows={4}
                  required
                  dir="auto"
                />
                <FieldDescription>
                  مطلوب: ثماني محارف على الأقل للحفاظ على سجل قابل للمراجعة.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="relationship-notes">ملاحظات داخلية</FieldLabel>
                <Textarea
                  id="relationship-notes"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={2}
                  dir="auto"
                />
              </Field>
              {people.length ? (
                <Field>
                  <FieldLabel>أشخاص مرتبطون (اختياري)</FieldLabel>
                  <FieldDescription>
                    يظهرون على حافة العلاقة كمشاركين، وليسوا طرفي العلاقة.
                  </FieldDescription>
                  <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                    {people.map((person) => (
                      <Field key={person.id} orientation="horizontal">
                        <Checkbox
                          id={`relationship-person-${person.id}`}
                          checked={Boolean(draft.people[person.id])}
                          onCheckedChange={(checked) =>
                            setDraft((current) => ({
                              ...current,
                              people: { ...current.people, [person.id]: checked === true },
                            }))
                          }
                        />
                        <FieldLabel htmlFor={`relationship-person-${person.id}`}>
                          {person.name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </div>
                </Field>
              ) : null}
              {mutation.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{mutation.error.message}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "جارٍ الحفظ…" : "حفظ العلاقة"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
