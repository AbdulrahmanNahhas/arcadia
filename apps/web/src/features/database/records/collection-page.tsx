import { Link } from "@tanstack/react-router";
import { PlusIcon, UploadIcon } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { RecordTable } from "@/components/dashboard/record-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogPage } from "@/features/catalog/entities/catalog-page";
import { WorksCatalog } from "@/features/catalog/works/works-catalog";
import type { collections } from "@/features/database/records/collections";

const collectionTables = {
  works: "titles",
  installments: "installments",
  episodes: "episodes",
  people: "entities",
  studios: "entities",
  planets: "planets",
  relationships: "title_relations",
  scores: "installment_scores",
  awards: "award_recognitions",
  vocabularies: "genres",
  credits: "contributions",
  evidence: "source_evidence",
};
interface CollectionPageProps {
  collection: (typeof collections)[number];
}
export function CollectionPage({ collection }: CollectionPageProps) {
  if (
    collection.slug === "people" ||
    collection.slug === "studios" ||
    collection.slug === "planets"
  )
    return <CatalogPage kind={collection.slug} />;
  return (
    <>
      <PageHeader
        title={collection.title}
        description={
          collection.slug === "works" ? "تصفح الأعمال وحدد ما تريد تحريره." : collection.description
        }
        eyebrow={collection.slug === "works" ? undefined : "قاعدة البيانات / المحتوى"}
        actions={
          <>
            {collection.slug !== "works" && (
              <Button variant="outline" disabled>
                <UploadIcon data-icon="inline-start" />
                استيراد
              </Button>
            )}
            {collection.slug === "works" ? (
              <Link to="/database/works/new" className={buttonVariants()}>
                <PlusIcon data-icon="inline-start" />
                مسودة عمل
              </Link>
            ) : (
              <Button disabled>
                <PlusIcon data-icon="inline-start" />
                {collection.action}
              </Button>
            )}
          </>
        }
      />

      {collection.slug === "works" ? (
        <WorksCatalog />
      ) : collection.slug === "awards" ? (
        <Tabs defaultValue="recognitions">
          <TabsList>
            <TabsTrigger value="recognitions">الترشيحات والنتائج</TabsTrigger>
            <TabsTrigger value="organizations">المنظمات</TabsTrigger>
            <TabsTrigger value="categories">الفئات</TabsTrigger>
            <TabsTrigger value="ceremonies">الحفلات</TabsTrigger>
          </TabsList>
          <TabsContent value="recognitions">
            <RecordTable
              table="award_recognitions"
              title="الترشيحات والنتائج"
              columns={collection.columns}
            />
          </TabsContent>
          <TabsContent value="organizations">
            <RecordTable
              table="award_organizations"
              title="منظمات الجوائز"
              columns={["الاسم", "المعرّف", "الموقع", "الفئات"]}
            />
          </TabsContent>
          <TabsContent value="categories">
            <RecordTable
              table="award_categories"
              title="فئات الجوائز"
              columns={["الفئة", "المنظمة", "النوع", "الوصف"]}
            />
          </TabsContent>
          <TabsContent value="ceremonies">
            <RecordTable
              table="award_ceremonies"
              title="الحفلات"
              columns={["المنظمة", "السنة", "اسم الحفل", "النتائج"]}
            />
          </TabsContent>
        </Tabs>
      ) : collection.slug === "vocabularies" ? (
        <Tabs defaultValue="genres">
          <TabsList variant="line">
            {[
              { key: "genres", title: "الأنواع" },
              { key: "tones", title: "النبرات" },
              { key: "tags", title: "الوسوم" },
              { key: "countries", title: "البلدان" },
              { key: "roles", title: "الأدوار" },
              { key: "labels", title: "التسميات" },
            ].map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {["genres", "tones", "tags", "countries", "roles", "labels"].map((key) => (
            <TabsContent key={key} value={key}>
              <RecordTable
                table={key === "roles" ? "roles" : key === "labels" ? "vocabulary_labels" : key}
                title="المفردات والتسميات"
                columns={collection.columns}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <RecordTable
          table={collectionTables[collection.slug]}
          title={`سجلات ${collection.title}`}
          columns={collection.columns}
        />
      )}
    </>
  );
}
