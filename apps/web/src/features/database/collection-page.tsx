import { Link } from "@tanstack/react-router";
import { PlusIcon, UploadIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/features/dashboard/page-header";
import { RecordTable } from "@/features/dashboard/record-table";
import { ServiceNotice } from "@/features/dashboard/service-notice";

import type { collections } from "./collections";

interface CollectionPageProps {
  collection: (typeof collections)[number];
}
export function CollectionPage({ collection }: CollectionPageProps) {
  return (
    <>
      <PageHeader
        title={collection.title}
        description={collection.description}
        eyebrow="قاعدة البيانات / المحتوى"
        upcoming
        actions={
          <>
            <Button variant="outline" disabled>
              <UploadIcon data-icon="inline-start" />
              استيراد
            </Button>
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
      <ServiceNotice />
      {collection.slug === "awards" ? (
        <Tabs defaultValue="recognitions">
          <TabsList>
            <TabsTrigger value="recognitions">الترشيحات والنتائج</TabsTrigger>
            <TabsTrigger value="organizations">المنظمات</TabsTrigger>
            <TabsTrigger value="categories">الفئات</TabsTrigger>
            <TabsTrigger value="ceremonies">الحفلات</TabsTrigger>
          </TabsList>
          <TabsContent value="recognitions">
            <RecordTable title="الترشيحات والنتائج" columns={collection.columns} />
          </TabsContent>
          <TabsContent value="organizations">
            <RecordTable title="منظمات الجوائز" columns={["الاسم", "المعرّف", "الموقع", "الفئات"]} />
          </TabsContent>
          <TabsContent value="categories">
            <RecordTable title="فئات الجوائز" columns={["الفئة", "المنظمة", "النوع", "الوصف"]} />
          </TabsContent>
          <TabsContent value="ceremonies">
            <RecordTable title="الحفلات" columns={["المنظمة", "السنة", "اسم الحفل", "النتائج"]} />
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
              <RecordTable title="المفردات والتسميات" columns={collection.columns} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <RecordTable title={`سجلات ${collection.title}`} columns={collection.columns} />
      )}
    </>
  );
}
