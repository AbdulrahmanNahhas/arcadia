import { ArchiveIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminVocabularyTerms } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const vocabularies = [
  ["genres", "التصنيفات"],
  ["tones", "الطابع"],
  ["tags", "الوسوم"],
  ["countries", "الدول"],
  ["roles", "الأدوار"],
  ["audiences", "الجمهور"],
  ["ages", "الأعمار"],
  ["risk-levels", "المخاطر"],
  ["release-statuses", "حالات الإصدار"],
] as const;
export function VocabulariesPage() {
  const { data: terms } = useSuspenseQuery({
    queryKey: ["admin-taxonomy-terms"],
    queryFn: () => getAdminVocabularyTerms(),
  });
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-12">
      <AdminPageHeader
        title="المفردات والترجمات"
        description="مسميات الكتالوج من قاعدة البيانات؛ تُؤرشف المصطلحات المستخدمة ولا تُحذف."
      />
      <div className="px-5 sm:px-6">
        <Tabs defaultValue="genres" dir="rtl">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {vocabularies.map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {vocabularies.map(([key, label]) => {
            const own = terms.filter((term) => term.vocabulary === key);
            return (
              <TabsContent key={key} value={key} className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>{label}</CardTitle>
                    <CardDescription>
                      {own.length} مصطلحاً · الترتيب نفسه يُستخدم في الواجهات.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {own.map((term) => (
                      <div
                        key={term.id}
                        className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[3rem_1fr_1fr_auto]"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {term.position}
                        </span>
                        <div>
                          <strong className="text-sm">{term.labelAr}</strong>
                          <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                            {term.slug}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm" dir="ltr">
                            {term.labelEn}
                          </span>
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {term.descriptionAr || "بلا وصف"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {key === "roles" && term.entityType && (
                            <Badge variant="outline">
                              {term.entityType === "person" ? "شخص" : "منظمة"}
                            </Badge>
                          )}
                          <Badge variant="outline">{term.usageCount} استخدام</Badge>
                          <Badge variant={term.isActive ? "secondary" : "outline"}>
                            {term.isActive ? <CheckCircleIcon /> : <ArchiveIcon />}
                            {term.isActive ? "نشط" : "مؤرشف"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
