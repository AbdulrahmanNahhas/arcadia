import { ProfileUpdateSchema, type User } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Save, ShieldCheck, Monitor, UserRound } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { gateway } from "@/lib/bridge";

import { CacheControl } from "../player/cache-control";
import { AccountAvatar, avatarChoices } from "./account-avatar";

const AvatarSelectionSchema = ProfileUpdateSchema.pick({ avatarKey: true });
function selectedAvatar(value: string) {
  return (
    AvatarSelectionSchema.safeParse({ avatarKey: value }).data?.avatarKey ?? "nahhasio-library.svg"
  );
}
export function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const result = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => gateway.profile(signal),
    staleTime: 0,
  });
  if (result.isPending)
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-6 p-8" aria-busy="true">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-96 w-full" />
      </section>
    );
  if (result.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذّر فتح الحساب</AlertTitle>
        <AlertDescription>
          {result.error.message}
          <Button variant="outline" onClick={() => void result.refetch()}>
            إعادة المحاولة
          </Button>
        </AlertDescription>
      </Alert>
    );
  return (
    <ProfileContent
      key={result.data.updatedAt}
      user={result.data}
      saved={saved}
      onSaved={() => setSaved(true)}
    />
  );
}
function ProfileContent({
  user,
  saved,
  onSaved,
}: {
  user: User;
  saved: boolean;
  onSaved: () => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [avatarKey, setAvatarKey] = useState(selectedAvatar(user.avatarKey));
  const update = useMutation({
    mutationFn: gateway.updateProfile,
    onSuccess: (next) => {
      client.setQueryData(["profile"], next);
      client.setQueryData(
        ["session"],
        (session: { user: User; expiresAt: string } | null | undefined) =>
          session ? { ...session, user: next } : session,
      );
      onSaved();
    },
  });
  const changed = name.trim() !== user.name || bio !== user.bio || avatarKey !== user.avatarKey;
  return (
    <article
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 max-[640px]:px-4"
      aria-label="الملف الشخصي"
    >
      <header className="flex flex-wrap items-center gap-6">
        <AccountAvatar name={user.name} avatarKey={user.avatarKey} className="size-24 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold">{user.name}</h1>
          <p className="truncate text-muted-foreground" dir="ltr">
            {user.email}
          </p>
          <div>
            <Badge variant="secondary">{user.isAdmin ? "مدير المكتبة" : "عضو المكتبة"}</Badge>
          </div>
        </div>
        {user.isAdmin && (
          <a href="#/admin" className={buttonVariants({ variant: "outline" })}>
            <ShieldCheck data-icon="inline-start" />
            لوحة الإدارة
          </a>
        )}
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5" />
                ملفك في المكتبة
              </CardTitle>
              <CardDescription>
                الاسم والصورة اللذان يظهران مع نشاطك. البريد مرتبط بحساب تسجيل الدخول.
              </CardDescription>
            </CardHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                update.mutate({ name: name.trim(), bio, avatarKey, updatedAt: user.updatedAt });
              }}
            >
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="profile-name">الاسم</FieldLabel>
                    <Input
                      id="profile-name"
                      maxLength={80}
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={update.isPending}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="profile-bio">نبذة عنك</FieldLabel>
                    <Textarea
                      id="profile-bio"
                      maxLength={500}
                      rows={3}
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                      disabled={update.isPending}
                    />
                    <FieldDescription>اختياري؛ حتى 500 حرف.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel id="avatar-label">صورة الحساب</FieldLabel>
                    <RadioGroup
                      aria-labelledby="avatar-label"
                      value={avatarKey}
                      onValueChange={(value) => setAvatarKey(selectedAvatar(value))}
                      className="flex flex-wrap gap-4"
                    >
                      {avatarChoices.map((avatar) => (
                        <Field key={avatar.key} orientation="horizontal">
                          <RadioGroupItem
                            id={avatar.key}
                            value={avatar.key}
                            disabled={update.isPending}
                          />
                          <FieldLabel htmlFor={avatar.key}>
                            <AccountAvatar
                              name={avatar.label}
                              avatarKey={avatar.key}
                              className="size-12"
                            />
                            {avatar.label}
                          </FieldLabel>
                        </Field>
                      ))}
                    </RadioGroup>
                  </Field>
                  {update.error && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {update.error.message}
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => void client.invalidateQueries({ queryKey: ["profile"] })}
                        >
                          إعادة تحميل الملف
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  {saved && (
                    <Alert>
                      <AlertDescription>تم حفظ الملف الشخصي.</AlertDescription>
                    </Alert>
                  )}
                </FieldGroup>
              </CardContent>
              <CardFooter className="pt-6">
                <Button type="submit" disabled={update.isPending || !changed || !name.trim()}>
                  <Save data-icon="inline-start" />
                  {update.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
                </Button>
              </CardFooter>
            </form>
          </Card>
          <PasswordCard />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="size-5" />
              هذا الجهاز
            </CardTitle>
            <CardDescription>
              ملفات التنزيل محلية لهذا التطبيق؛ إعدادات حسابك محفوظة في الخادم.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CacheControl />
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
function PasswordCard() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const update = useMutation({
    mutationFn: gateway.updatePassword,
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirmation("");
    },
  });
  const mismatch = confirmation.length > 0 && confirmation !== newPassword;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole className="size-5" />
          أمان الحساب
        </CardTitle>
        <CardDescription>
          بعد تغيير كلمة المرور، تُنهى جلساتك الأخرى ويبقى هذا التطبيق متصلاً.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (newPassword === confirmation) update.mutate({ currentPassword, newPassword });
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">كلمة المرور الحالية</FieldLabel>
              <Input
                id="current-password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
                maxLength={128}
                value={currentPassword}
                onChange={(event) => setCurrent(event.target.value)}
                disabled={update.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">كلمة المرور الجديدة</FieldLabel>
              <Input
                id="new-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNext(event.target.value)}
                disabled={update.isPending}
              />
              <FieldDescription>من 6 إلى 128 حرفاً.</FieldDescription>
            </Field>
            <Field data-invalid={mismatch}>
              <FieldLabel htmlFor="confirm-password">تأكيد كلمة المرور</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                maxLength={128}
                aria-invalid={mismatch}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={update.isPending}
              />
              {mismatch && <FieldDescription>كلمتا المرور غير متطابقتين.</FieldDescription>}
            </Field>
            {update.error && (
              <Alert variant="destructive">
                <AlertDescription>{update.error.message}</AlertDescription>
              </Alert>
            )}
            {update.isSuccess && (
              <Alert>
                <AlertDescription>تغيّرت كلمة المرور وانتهت الجلسات الأخرى.</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="pt-6">
          <Button
            variant="outline"
            type="submit"
            disabled={
              update.isPending ||
              !currentPassword ||
              newPassword.length < 6 ||
              newPassword !== confirmation
            }
          >
            {update.isPending ? "جارٍ التغيير…" : "تغيير كلمة المرور"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
