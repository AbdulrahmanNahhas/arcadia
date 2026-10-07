import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

import { uploadArtwork } from "./artwork.functions";
import { databaseKeys } from "./database.queries";
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.addEventListener("error", () => reject(new Error("تعذّرت قراءة الصورة")), { once: true });
    reader.readAsDataURL(file);
  });
}
export function ArtworkUpload() {
  const client = useQueryClient();
  const upload = useMutation({
    mutationFn: async (form: FormData) => {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 10000000)
        throw new Error("اختر صورة لا تتجاوز 10 ميغابايت");
      return uploadArtwork({
        data: {
          dataUrl: await readImage(file),
          fileName: file.name,
          role: "poster",
          ownerName: String(form.get("ownerName") ?? "image"),
        },
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: databaseKeys.records("media_assets") }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>رفع صورة</CardTitle>
        <CardDescription>
          JPEG، PNG، WebP أو GIF · تُحفظ الصورة الأصلية ويُسجّل محتواها دون حذف صور سابقة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="artwork-upload"
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate(new FormData(event.currentTarget));
          }}
        >
          <FieldGroup className="grid sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="artwork-upload-file">ملف الصورة</FieldLabel>
              <Input
                id="artwork-upload-file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="artwork-upload-name">اسم العمل أو الشخص</FieldLabel>
              <Input id="artwork-upload-name" name="ownerName" required />
            </Field>
          </FieldGroup>
        </form>
        {upload.isError && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر الرفع</AlertTitle>
            <AlertDescription>{upload.error.message}</AlertDescription>
          </Alert>
        )}
        {upload.isSuccess && (
          <Alert>
            <AlertTitle>حُفظت الصورة</AlertTitle>
            <AlertDescription>يمكن ربطها بالسجل من تبويب روابط الصور.</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button form="artwork-upload" type="submit" disabled={upload.isPending}>
          {upload.isPending ? "جارٍ الرفع…" : "رفع وحفظ"}
        </Button>
      </CardFooter>
    </Card>
  );
}
