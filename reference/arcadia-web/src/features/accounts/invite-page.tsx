import { CheckCircleIcon, KeyIcon, PlanetIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export function InvitePage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<{ username: string }>("/api/v1/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      const login = await authClient.signIn.username({ username: result.username, password });
      if (login.error) throw new Error("تم تفعيل الحساب، لكن يلزم تسجيل الدخول يدوياً.");
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر تفعيل الدعوة.");
      setPending(false);
    }
  }

  const valid = password.length >= 8 && password === confirmation;
  return (
    <main className="platform-surface grid min-h-svh place-items-center px-5 py-12">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="h-1 bg-linear-to-l from-amber-400 via-primary to-violet-500" />
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PlanetIcon size={24} weight="duotone" />
          </span>
          <CardTitle className="font-heading text-2xl">أهلاً بك في مدار العائلة</CardTitle>
          <CardDescription>
            اختر كلمة مرور خاصة بك. بعد التفعيل ستدخل إلى أركاديا مباشرة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-password">كلمة المرور</FieldLabel>
              <Input
                id="new-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <FieldDescription>ثمانية أحرف على الأقل.</FieldDescription>
            </Field>
            <Field data-invalid={Boolean(confirmation && confirmation !== password)}>
              <FieldLabel htmlFor="confirm-password">تأكيد كلمة المرور</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={confirmation}
                aria-invalid={Boolean(confirmation && confirmation !== password)}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <KeyIcon />
                <AlertTitle>تعذّر التفعيل</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button size="lg" disabled={!valid || pending} onClick={accept}>
              <CheckCircleIcon data-icon="inline-start" />
              {pending ? "جارٍ تفعيل الحساب…" : "تفعيل والدخول"}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </main>
  );
}
