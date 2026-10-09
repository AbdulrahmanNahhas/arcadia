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

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-375 grid-cols-1 md:grid-cols-2">
      <section className="flex min-h-0 flex-col justify-between gap-10 bg-card px-8 py-10 md:min-h-dvh md:gap-15 md:px-[clamp(30px,7vw,110px)] md:py-14">
        <div className="flex items-center gap-3.5 text-[27px] font-semibold">
          <span className="text-primary">
            <Library className="size-9" />
          </span>
          <span>
            نحّاسيو
            <small className="block text-[10px] font-normal tracking-[0.16em] text-muted-foreground">
              NAHHASIO
            </small>
          </span>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-primary">
            مكتبتنا، بطريقتنا
          </p>
          <h1 className="mb-5 text-[34px] leading-relaxed font-semibold md:text-[clamp(40px,4.5vw,68px)]">
            كل حكاية.
            <br className="max-sm:hidden" />
            في مكانها.
          </h1>
          <p className="max-sm:hidden max-w-85 text-sm leading-loose text-muted-foreground md:text-base">
            أعمال نختارها بعناية، وتفاصيل تساعدنا على الاختيار. مساحة واحدة لمكتبة العائلة.
          </p>
        </div>
        <p className="max-sm:hidden flex items-center gap-2.5 text-xs text-muted-foreground">
          <ShieldCheck size={18} /> مكتبتك متصلة بخادمك الخاص
        </p>
      </section>
      <section className="flex items-center justify-center px-8 py-9 md:px-11">
        <form
          className="flex w-full max-w-87.5 flex-col gap-3.5 max-sm:max-w-105"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-primary">أهلًا بك</p>
          <h2 className="text-2xl font-semibold md:text-[29px]">ادخل إلى مكتبتك</h2>
          <p className="mb-6 text-xs text-muted-foreground">استخدم حسابك في خادم نحّاسيو.</p>
          <label className="mt-1.5 text-xs text-foreground/80" htmlFor="email">
            البريد الإلكتروني
          </label>
          <Input
            id="email"
            className="h-12 min-w-0 rounded-xl border border-input bg-secondary px-3.5 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="mt-1.5 text-xs text-foreground/80" htmlFor="password">
            كلمة المرور
          </label>
          <Input
            id="password"
            className="h-12 min-w-0 rounded-xl border border-input bg-secondary px-3.5 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {!nativeAvailable() && (
            <p
              className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
              role="alert"
            >
              افتح هذه الواجهة من تطبيق Linux للاتصال بالخادم.
            </p>
          )}
          {login.error && (
            <p
              className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
              role="alert"
            >
              {login.error.message}
            </p>
          )}
          <Button
            className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            disabled={login.isPending || !nativeAvailable()}
            type="submit"
          >
            {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
            <ArrowLeft size={18} />
          </Button>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
            تُحفظ جلسة الدخول داخل التطبيق فقط.
          </p>
        </form>
      </section>
    </main>
  );
}
