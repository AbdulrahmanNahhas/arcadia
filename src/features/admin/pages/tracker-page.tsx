import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityFeedPage } from "@/features/activity/activity-feed-page";
import { TrackingForm } from "@/features/library/components/tracking-form";
import { getWorkStructure, getWorks } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

export function AdminTrackerPage() {
  return <ActivityFeedPage embedded />;
}

export function AdminTrackingEntryPage() {
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const [workId, setWorkId] = useState(works[0]?.id ?? "");
  const work = works.find((item) => item.id === workId);
  const structure = useQuery({
    queryKey: ["work-structure", workId],
    queryFn: () => getWorkStructure({ data: { workId } }),
    enabled: Boolean(workId),
  });
  const items = works.map((item) => ({ value: item.id, label: item.arabicTitle || item.title }));
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <AdminPageHeader
        title="تسجيل تقدم"
        description="إضافة نقطة متابعة جديدة إلى السجل المحلي. بيانات المتابعة منفصلة عن بيانات الكتالوج."
      />
      <Card>
        <CardHeader>
          <CardTitle>العمل والتقدم</CardTitle>
          <CardDescription>اختر العمل ثم حدّث حالته أو موضع التقدم.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="tracking-work-page">العمل</FieldLabel>
            <Select items={items} value={workId} onValueChange={(value) => setWorkId(value ?? "")}>
              <SelectTrigger id="tracking-work-page" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {work ? <TrackingForm key={work.id} work={work} structure={structure.data} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
