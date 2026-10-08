import type { WorkDocument } from "@arcadia/cli/work";
import { cn } from "cn";
import { ImageIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { animeIdentityKeys, seriesIdentityKeys } from "@/features/editor/artwork/artwork-model";
import { ArtworkPicker } from "@/features/editor/artwork/artwork-picker";
import { IdentityFields } from "@/features/editor/fields/identity-fields";
import { TextField } from "@/features/editor/fields/work-fields";
import { ReferencePicker } from "@/features/editor/references/reference-picker";
import { WorkReferences } from "@/features/editor/references/work-references";

type Installment = NonNullable<WorkDocument["installments"]>[number];
type Update = <K extends keyof WorkDocument>(key: K, value: WorkDocument[K]) => void;
export function WorkImages({
  draft,
  original,
  update,
}: {
  draft: WorkDocument;
  original: WorkDocument;
  update: Update;
}) {
  return (
    <FieldGroup>
      <Field orientation="horizontal">
        <Checkbox
          id="work-private"
          checked={draft.isPrivate ?? false}
          onCheckedChange={(value) => update("isPrivate", value)}
        />
        <FieldLabel htmlFor="work-private">عمل خاص — مخفي من المنصة</FieldLabel>
      </Field>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {(
          [
            { key: "poster", label: "الملصق" },
            { key: "banner", label: "الخلفية" },
            { key: "logo", label: "الشعار" },
          ] as const
        ).map((field) => (
          <ArtworkField
            key={field.key}
            label={field.label}
            role={field.key}
            work={draft}
            original={original.media?.[field.key]}
            value={draft.media?.[field.key]}
            onChange={(value) => update("media", { ...draft.media, [field.key]: value })}
          />
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>ملصقات الأجزاء</CardTitle>
          <CardDescription>
            لكل جزء صورته ومعرّفاته. تُراجع تغييرات الصور مع بقية تغييرات العمل.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {draft.installments?.map((part, index) => {
              function updateIdentity(
                key: (typeof seriesIdentityKeys)[number] | (typeof animeIdentityKeys)[number],
                value: string | number | null,
              ) {
                update(
                  "installments",
                  draft.installments?.map((item, position) =>
                    position === index
                      ? {
                          ...item,
                          [key]:
                            value === null
                              ? null
                              : key === "imdbId"
                                ? String(value)
                                : Number(value),
                        }
                      : item,
                  ),
                );
              }
              return (
                <ArtworkField
                  key={part.id ?? part.position}
                  label={part.title}
                  role="poster"
                  work={draft}
                  installment={part}
                  original={
                    original.installments?.find((item) => item.id === part.id)?.media?.poster
                  }
                  value={part.media?.poster}
                  onChange={(value) =>
                    update(
                      "installments",
                      draft.installments?.map((item, position) =>
                        position === index
                          ? { ...item, media: { ...item.media, poster: value } }
                          : item,
                      ),
                    )
                  }
                >
                  {draft.format === "animated" && (
                    <IdentityFields
                      compact
                      prefix={`${part.title} · `}
                      ids={part}
                      keys={animeIdentityKeys}
                      series={false}
                      onChange={updateIdentity}
                    />
                  )}
                  {part.kind === "movie" && (
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        معرّفات {part.title}
                      </summary>
                      <div className="py-3">
                        <IdentityFields
                          compact
                          prefix={`${part.title} · `}
                          ids={part}
                          keys={seriesIdentityKeys}
                          series={false}
                          onChange={updateIdentity}
                        />
                      </div>
                    </details>
                  )}
                </ArtworkField>
              );
            })}
          </div>
          {!draft.installments?.length && (
            <p className="text-sm text-muted-foreground">
              أضف جزءاً من تبويب البنية ليظهر ملصقه هنا.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>المراجع والعلاقات</CardTitle>
          <CardDescription>
            معرّفات المصادر مع روابط المعاينة، والمراجع والأعمال المرتبطة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkReferences draft={draft} update={update} />
        </CardContent>
      </Card>
    </FieldGroup>
  );
}
function ArtworkField({
  label,
  role,
  work,
  installment,
  original,
  value,
  onChange,
  children,
}: {
  children?: ReactNode;
  label: string;
  role: "poster" | "banner" | "logo";
  work: WorkDocument;
  installment?: Installment;
  original?: string | null;
  value?: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "الحالية", path: original },
              { label: "المسودة", path: value },
            ].map((preview) => (
              <div key={preview.label} className="flex min-w-0 flex-col gap-2">
                <p className="text-xs text-muted-foreground">{preview.label}</p>
                <div
                  className={cn(
                    "flex items-center justify-center rounded-lg border bg-muted",
                    role === "poster" && "aspect-2/3",
                    role === "banner" && "aspect-video",
                    role === "logo" && "aspect-square",
                  )}
                >
                  {preview.path?.startsWith("/media/") ? (
                    <img
                      src={preview.path}
                      alt={`${label} ${preview.label}`}
                      loading="lazy"
                      className="size-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="size-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">مسار الصورة</summary>
            <div className="pt-2">
              <TextField
                label={`مسار صورة ${label}`}
                value={value}
                onChange={(next) => onChange(next || null)}
              />
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <ReferencePicker
              table="media_assets"
              title={`اختيار صورة ${label}`}
              triggerLabel="مكتبة الصور"
              images
              imageRole={role}
              onPick={onChange}
            />
            <ArtworkPicker work={work} installment={installment} role={role} onPick={onChange} />
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                <XIcon data-icon="inline-start" />
                إزالة الصورة
              </Button>
            )}
          </div>
          {children}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
