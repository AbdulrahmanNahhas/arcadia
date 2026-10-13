import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Library, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { gateway, nativeAvailable } from "@/lib/bridge";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const client = useQueryClient();
  const login = useMutation({
    mutationFn: gateway.login,
    onSuccess: async (session) => {
      setPassword("");
      setVisible(false);
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session" && query.queryKey[0] !== "native",
      });
      client.setQueryData(["session"], session);
    },
  });
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2.5 px-6 py-6 text-primary sm:px-10 sm:py-8">
        <Library className="size-7 shrink-0" aria-hidden="true" />
        <span className="font-display text-2xl font-semibold">نحّاسيو</span>
      </header>
      <div className="flex flex-1 items-center justify-center px-5 pt-6 pb-16 sm:pt-10 sm:pb-24">
        <section
          className="flex w-full max-w-md flex-col gap-8 rounded-lg bg-card px-6 py-10 sm:px-12 sm:py-12"
          aria-labelledby="login-heading"
        >
          <div className="flex flex-col gap-3">
            <h1 id="login-heading" className="font-display text-3xl font-semibold">
              ادخل إلى مكتبتك
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              أعمالك المفضلة، في مكان واحد.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!login.isPending) login.mutate({ email: email.trim(), password });
            }}
          >
            <FieldGroup>
              <Field data-disabled={login.isPending}>
                <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
                <Input
                  id="email"
                  className="h-12"
                  type="email"
                  dir="ltr"
                  autoComplete="username"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={login.isPending}
                  placeholder="you@nahhasio.local"
                />
              </Field>
              <Field data-disabled={login.isPending}>
                <FieldLabel htmlFor="password">كلمة المرور</FieldLabel>
                <InputGroup className="h-12">
                  <InputGroupInput
                    id="password"
                    type={visible ? "text" : "password"}
                    dir="ltr"
                    autoComplete="current-password"
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                    disabled={login.isPending}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-sm"
                      aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      aria-pressed={visible}
                      disabled={login.isPending}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {capsLock && <FieldDescription>مفتاح الأحرف الكبيرة مفعّل.</FieldDescription>}
              </Field>
              {!nativeAvailable() && (
                <Alert variant="destructive">
                  <AlertDescription>
                    افتح نحّاسيو من تطبيق سطح المكتب للاتصال بالخادم.
                  </AlertDescription>
                </Alert>
              )}
              {login.error && (
                <Alert variant="destructive">
                  <AlertDescription>{login.error.message}</AlertDescription>
                </Alert>
              )}
              <Button
                size="lg"
                className="mt-2 h-12 w-full"
                disabled={login.isPending || !nativeAvailable()}
                type="submit"
              >
                {login.isPending ? <Spinner data-icon="inline-start" /> : null}
                {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
                <ArrowLeft data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            مكتبة خاصة لك ولعائلتك. للدخول، استخدم حساب مكتبتك.
          </p>
        </section>
      </div>
    </main>
  );
}
