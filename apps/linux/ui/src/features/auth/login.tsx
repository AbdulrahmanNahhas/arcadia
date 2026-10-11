import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Library, ShieldCheck } from "lucide-react";
import { useState } from "react";

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
    "h-12 min-w-0 rounded-full border border-white/10 bg-white/5 px-5 text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:border-primary/60 focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-black px-6 py-12">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 70%), radial-gradient(40% 40% at 95% 5%, rgba(255,255,255,0.05), transparent 70%)",
        }}
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
          <label className="px-2 text-xs text-foreground/70" htmlFor="email">
            البريد الإلكتروني
          </label>
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

          <label className="mt-1 px-2 text-xs text-foreground/70" htmlFor="password">
            كلمة المرور
          </label>
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

          {!nativeAvailable() && (
            <p
              className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
              role="alert"
            >
              افتح هذه الواجهة من تطبيق Linux للاتصال بالخادم.
            </p>
          )}
          {login.error && (
            <p
              className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
              role="alert"
            >
              {login.error.message}
            </p>
          )}

          <Button
            className="mt-4 flex h-12 items-center justify-center gap-3 rounded-full bg-primary px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 disabled:opacity-40"
            disabled={login.isPending || !nativeAvailable()}
            type="submit"
          >
            {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
            <ArrowLeft size={18} />
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
