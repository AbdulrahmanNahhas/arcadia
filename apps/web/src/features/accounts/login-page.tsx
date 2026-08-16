import { ar } from "@arcadia/i18n";
import { ArrowLeftIcon, LockKeyIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function LoginPage() {
  const search = useSearch({ strict: false }) as { next?: string };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => setInteractive(true), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await authClient.signIn.username({ username, password, rememberMe: true });
    setPending(false);
    if (result.error) {
      setMessage(ar.auth.invalidCredentials);
      return;
    }
    window.location.assign(search.next?.startsWith("/") ? search.next : "/");
  }

  return (
    <main className="platform-surface relative min-h-svh overflow-hidden px-5 py-10 sm:grid sm:place-items-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_34%),radial-gradient(circle_at_12%_90%,color-mix(in_oklab,var(--chart-3)_14%,transparent),transparent_38%)]" />
      <section className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative min-h-72 overflow-hidden p-8 sm:p-12 lg:min-h-160">
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center opacity-65 blur-md"
            style={{ backgroundImage: "url('/media/account-avatar-sprite.webp')" }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/55 to-background/10" />
          <div className="relative flex h-full flex-col justify-end">
            <div className="mt-36 max-w-md lg:mt-0">
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary">
                مدار العائلة
              </p>
              <h1 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
                مكتبتكم، وذكرياتكم، في مكان واحد.
              </h1>
              <p className="mt-5 max-w-sm leading-7 text-muted-foreground">
                أركاديا مساحة خاصة للعائلة الممتدة: اكتشفوا الأعمال، شاركوا الانطباعات، واحتفظوا بكل
                تجربة في مدارها المناسب.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center p-6 sm:p-0 h-full">
          <Card className="w-full border-0! bg-transparent shadow-none h-full p-10 flex flex-col justify-center">
            <CardHeader className="px-0">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UsersThreeIcon size={22} weight="duotone" />
              </div>
              <CardTitle className="font-heading auth.titletext-2xl">{ar.auth.title}</CardTitle>
              <CardDescription>
                استخدم الحساب الذي أنشأه مدير العائلة أو رابط الدعوة.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="username">{ar.auth.username}</FieldLabel>
                    <Input
                      id="username"
                      name="username"
                      dir="ltr"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      disabled={!interactive || pending}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">{ar.auth.password}</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      dir="ltr"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={!interactive || pending}
                      required
                    />
                    <FieldDescription>ثمانية أحرف على الأقل.</FieldDescription>
                  </Field>
                  {message ? (
                    <Alert variant="destructive">
                      <LockKeyIcon />
                      <AlertTitle>تعذّر الدخول</AlertTitle>
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  ) : null}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={pending || !interactive}
                    aria-busy={pending || !interactive}
                  >
                    {!interactive ? "جارٍ تجهيز الدخول…" : pending ? "جارٍ الدخول…" : ar.auth.signIn}
                    <ArrowLeftIcon data-icon="inline-end" />
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
