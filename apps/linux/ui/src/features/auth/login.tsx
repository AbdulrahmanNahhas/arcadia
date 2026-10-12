import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Library, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { gateway, nativeAvailable } from "../../lib/bridge";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const client = useQueryClient();
  const login = useMutation({
    mutationFn: gateway.login,
    onSuccess: (session) => {
      setPassword("");
      client.setQueryData(["session"], session);
    },
  });

  const inputClass =
    "h-12 min-w-0 rounded-full border border-foreground/10 bg-foreground/5 px-5 text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:border-primary/60 focus-visible:bg-foreground/8 focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-black px-6 py-12">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_15%_10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_70%),radial-gradient(40%_40%_at_95%_5%,color-mix(in_oklab,var(--foreground)_5%,transparent),transparent_70%)]"
      />

      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {/* brand */}
        <div className="mb-10 flex items-center gap-3 text-[26px] font-semibold">
          <span className="text-primary">
            <Library className="size-9" />
          </span>
          <span className="text-start leading-tight">
            نحّاسيو
            <small className="block text-[10px] font-normal tracking-[0.2em] text-muted-foreground">
              NAHHASIO
            </small>
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">ادخل إلى مكتبتك</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          مكتبتنا، بطريقتنا. استخدم حسابك في خادم نحّاسيو.
        </p>

        {/* avatar-style circle */}
        <div className="my-8 flex size-24 items-center justify-center rounded-full border-2 border-white/10 bg-white/5 text-primary shadow-[0_0_60px_-10px_var(--primary)]">
          <Library className="size-10" />
        </div>

        <form
          className="flex w-full flex-col gap-3 text-start"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel className="px-2 text-xs text-foreground/70" htmlFor="email">
                البريد الإلكتروني
              </FieldLabel>
              <Input
                id="email"
                className={inputClass}
                type="email"
                dir="ltr"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel className="mt-1 px-2 text-xs text-foreground/70" htmlFor="password">
                كلمة المرور
              </FieldLabel>
              <Input
                id="password"
                className={inputClass}
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </FieldGroup>

          {!nativeAvailable() && (
            <Alert variant="destructive">
              <AlertDescription>افتح هذه الواجهة من تطبيق Linux للاتصال بالخادم.</AlertDescription>
            </Alert>
          )}
          {login.error && (
            <Alert variant="destructive">
              <AlertDescription>{login.error.message}</AlertDescription>
            </Alert>
          )}

          <Button
            size="lg"
            className="mt-4 h-12 rounded-full"
            disabled={login.isPending || !nativeAvailable()}
            type="submit"
          >
            {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </form>

        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={16} />
          مكتبتك متصلة بخادمك الخاص · تُحفظ الجلسة داخل التطبيق فقط
        </p>
      </div>
    </main>
  );
}
