import type { WorkDocument } from "@arcadia/cli/work";
import { workScore } from "@arcadia/domain";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ageChoices,
  audienceChoices,
  riskChoices,
} from "@/features/database/classification-choices";
import { workflowLabels } from "@/features/database/works-model";
import { WorkScoreBadge, WorkScoreDetails } from "@/features/scoring/work-score";

import { AwardsEditor } from "./awards-editor";
import { ChangeReview } from "./change-review";
import { equalValue, fieldKeys, projectDocuments, type WorkSnapshot } from "./document-model";
import { workSnapshotsOptions } from "./document.queries";
import { ReferenceListField } from "./reference-field";
import { useDocumentReview } from "./use-document-review";
import { WorkDraftJson } from "./work-draft-json";
import { SelectField, StringListField, TextField } from "./work-fields";
import { WorkImages } from "./work-images";
import { WorkReferences } from "./work-references";

const StructureEditor = lazy(() =>
  import("./structure-editor").then((module) => ({ default: module.StructureEditor })),
);

export function WorkDetailPage({ id }: { id: string }) {
  const query = useQuery(workSnapshotsOptions([id]));
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذّر تحميل العمل</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
        <Button variant="outline" onClick={() => void query.refetch()}>
          إعادة المحاولة
        </Button>
      </Alert>
    );
  const snapshot = query.data[0];
  if (!snapshot) return null;
  return <WorkWorkspace key={snapshot.revision} snapshot={snapshot} />;
}
export function WorkWorkspace({
  snapshot,
  create = false,
}: {
  snapshot: WorkSnapshot;
  create?: boolean;
}) {
  const [draft, setDraft] = useState(snapshot.document);
  const state = useSearch({ from: "__root__" });
  const navigate = useNavigate();
  const dirty = !equalValue(snapshot.document, draft);
  const json = JSON.stringify(create ? draft : projectDocuments([draft], fieldKeys));
  const flow = useDocumentReview([snapshot], json, dirty, create);
  function update<K extends keyof WorkDocument>(key: K, value: WorkDocument[K]) {
    flow.changed();
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const name = create
    ? draft.titleAr || draft.canonicalTitle || "عمل جديد"
    : snapshot.document.titleAr || snapshot.document.canonicalTitle;
  const error = flow.save.error ?? flow.prepare.error;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          {snapshot.document.media?.poster?.startsWith("/media/") && (
            <img
              src={snapshot.document.media.poster}
              alt=""
              className="w-16 shrink-0 rounded-md object-cover sm:w-20"
            />
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <Link
              to="/database/$collection"
              params={{ collection: "works" }}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              الأعمال
            </Link>
            <h1 className="break-words text-2xl font-semibold">{name}</h1>
            <p dir="auto" className="text-sm text-muted-foreground">
              {snapshot.document.canonicalTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {snapshot.document.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
              </Badge>
              <Badge variant="outline">{snapshot.document.releaseYear ?? "بلا سنة"}</Badge>
              <Badge variant="outline">
                {workflowLabels[snapshot.document.workflowStatus ?? "draft"]}
              </Badge>
              {snapshot.document.isPrivate && <Badge variant="secondary">خاص</Badge>}
              <WorkScoreBadge
                score={workScore((draft.installments ?? []).map((item) => item.score ?? {}))}
              />
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {draft.installments?.length ?? 0} جزء ·{" "}
          {draft.installments?.reduce((sum, item) => sum + (item.episodes?.length ?? 0), 0) ?? 0}{" "}
          حلقة
        </p>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>لم تُحفظ التغييرات</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {flow.saved && (
        <Alert>
          <AlertTitle>حُفظت التغييرات</AlertTitle>
        </Alert>
      )}
      {flow.review ? (
        <ChangeReview
          review={flow.review}
          busy={flow.busy}
          onBack={flow.back}
          onSave={() => {
            if (flow.review) flow.save.mutate(flow.review.ticket);
          }}
        />
      ) : (
        <>
          <Tabs
            value={state.section === "references" ? "images" : (state.section ?? "identity")}
            onValueChange={(section) => {
              if (
                section === "identity" ||
                section === "structure" ||
                section === "indexing" ||
                section === "editorial" ||
                section === "images" ||
                section === "references" ||
                section === "awards"
              )
                void navigate({
                  to: ".",
                  replace: true,
                  search: (previous) => ({ ...previous, section }),
                });
            }}
          >
            <div className="max-w-full overflow-x-auto">
              <TabsList variant="line">
                <TabsTrigger value="identity">نظرة عامة</TabsTrigger>
                <TabsTrigger value="structure">البنية</TabsTrigger>
                <TabsTrigger value="indexing">الفهرسة</TabsTrigger>
                <TabsTrigger value="editorial">التحرير</TabsTrigger>
                <TabsTrigger value="images">الصور والمراجع</TabsTrigger>
                <TabsTrigger value="awards">الجوائز</TabsTrigger>
              </TabsList>
            </div>
            <fieldset disabled={flow.busy} className="min-w-0">
              <TabsContent value="identity">
                <Card>
                  <CardHeader>
                    <CardTitle>هوية العمل</CardTitle>
                    <CardDescription>الأسماء والوصف والحقائق.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <FieldGroup className="grid md:grid-cols-2">
                        <TextField
                          label="العنوان الأصلي"
                          value={draft.canonicalTitle}
                          onChange={(value) => update("canonicalTitle", value)}
                        />
                        <TextField
                          label="العنوان العربي"
                          value={draft.titleAr}
                          onChange={(value) => update("titleAr", value || null)}
                        />
                        <TextField
                          label="سنة الإصدار"
                          type="number"
                          min={1800}
                          max={2200}
                          value={draft.releaseYear}
                          onChange={(value) => update("releaseYear", value ? Number(value) : null)}
                        />
                        <SelectField
                          label="الصيغة"
                          value={draft.format ?? "animated"}
                          onChange={(value) => update("format", value)}
                          items={[
                            { value: "animated", label: "رسوم متحركة" },
                            { value: "live-action", label: "تمثيل حي" },
                          ]}
                        />
                      </FieldGroup>
                      <StringListField
                        label="الأسماء البديلة"
                        values={draft.aliases ?? []}
                        onChange={(value) => update("aliases", value)}
                      />
                      <TextField
                        label="الملخص"
                        multiline
                        value={draft.summary}
                        onChange={(value) => update("summary", value)}
                      />
                      <StringListField
                        label="حقائق ومعلومات"
                        ordered
                        values={draft.trivia ?? []}
                        onChange={(value) => update("trivia", value)}
                      />
                    </FieldGroup>
                  </CardContent>
                </Card>
                <WorkScoreDetails installments={draft.installments ?? []} />
              </TabsContent>
              <TabsContent value="structure">
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <StructureEditor
                    workId={snapshot.document.id ?? ""}
                    installments={draft.installments ?? []}
                    onChange={(value) => update("installments", value)}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="indexing">
                <Card>
                  <CardHeader>
                    <CardTitle>التصنيف والمساهمون</CardTitle>
                    <CardDescription>اختر المفردات المعتمدة أو ابحث عن سجل محدد.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <FieldGroup className="grid md:grid-cols-2">
                        {(
                          [
                            { key: "genres", label: "التصنيفات" },
                            { key: "tags", label: "الوسوم" },
                            { key: "tones", label: "الطابع" },
                            { key: "countries", label: "الدول" },
                            { key: "planets", label: "الكواكب" },
                          ] as const
                        ).map((field) => (
                          <ReferenceListField
                            key={field.key}
                            label={field.label}
                            table={field.key}
                            values={draft[field.key] ?? []}
                            onChange={(value) => update(field.key, value)}
                          />
                        ))}
                      </FieldGroup>
                      <WorkReferences draft={draft} update={update} creditsOnly />
                    </FieldGroup>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="editorial">
                <Card>
                  <CardHeader>
                    <CardTitle>التحرير والتصنيف العائلي</CardTitle>
                    <CardDescription>التصنيف والتنبيهات والملاحظات وحالة النشر.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <FieldGroup className="grid md:grid-cols-2 lg:grid-cols-3">
                        <SelectField
                          label="الجمهور"
                          value={draft.audience ?? "general"}
                          items={audienceChoices}
                          onChange={(value) => update("audience", value)}
                        />
                        <SelectField
                          label="تصنيف السن"
                          value={draft.age ?? "all"}
                          items={ageChoices}
                          onChange={(value) => update("age", value)}
                        />
                        {(
                          [
                            { key: "sexualityRisk", label: "المحتوى الجنسي" },
                            { key: "behavioralRisk", label: "المحتوى السلوكي" },
                            { key: "theologyRisk", label: "المحتوى العقدي" },
                          ] as const
                        ).map((field) => (
                          <SelectField
                            key={field.key}
                            label={field.label}
                            value={draft[field.key] ?? "none"}
                            items={riskChoices}
                            onChange={(value) => update(field.key, value)}
                          />
                        ))}
                        <SelectField
                          label="حالة النشر"
                          value={draft.workflowStatus ?? "draft"}
                          items={[
                            { value: "draft", label: workflowLabels.draft },
                            { value: "in_review", label: workflowLabels.in_review },
                            { value: "approved", label: workflowLabels.approved },
                            { value: "published", label: workflowLabels.published },
                            { value: "archived", label: workflowLabels.archived },
                          ]}
                          onChange={(value) => update("workflowStatus", value)}
                        />
                      </FieldGroup>
                      {(
                        [
                          { key: "contentWarnings", label: "تنبيهات المحتوى" },
                          { key: "analysisNotes", label: "ملاحظات التحليل" },
                          { key: "curatorNotes", label: "ملاحظات المحرر" },
                        ] as const
                      ).map((field) => (
                        <TextField
                          key={field.key}
                          label={field.label}
                          multiline
                          value={draft[field.key]}
                          onChange={(value) => update(field.key, value)}
                        />
                      ))}
                    </FieldGroup>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="images">
                <WorkImages draft={draft} original={snapshot.document} update={update} />
              </TabsContent>
              <TabsContent value="awards">
                <AwardsEditor draft={draft} onChange={(value) => update("awards", value)} />
              </TabsContent>
            </fieldset>
          </Tabs>
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={dirty ? "secondary" : "outline"}>
                {dirty ? "تغييرات غير محفوظة" : create ? "مسودة جديدة" : "كل التغييرات محفوظة"}
              </Badge>
              <WorkDraftJson
                document={draft}
                disabled={flow.busy}
                onApply={(value) => {
                  flow.changed();
                  setDraft((current) => ({ ...current, ...value }));
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={!dirty || flow.busy}
                onClick={() => {
                  setDraft(snapshot.document);
                  flow.changed();
                }}
              >
                تجاهل التغييرات
              </Button>
              <Button
                disabled={!dirty || flow.busy || !draft.canonicalTitle.trim()}
                onClick={() => flow.prepare.mutate(json)}
              >
                <CheckIcon data-icon="inline-start" />
                {flow.prepare.isPending
                  ? "جارٍ المراجعة…"
                  : create
                    ? "مراجعة العمل"
                    : "مراجعة التغييرات"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
