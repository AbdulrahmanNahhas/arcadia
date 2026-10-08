import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";

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

import { loginOwner } from "./auth.functions";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => loginOwner({ data: { email, password } }),
    onSuccess: async () => {
      setPassword("");
      router.options.context.queryClient.clear();
      await router.invalidate();
      await router.navigate({ to: "/", replace: true });
    },
  });
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>تسجيل الدخول</h1>
          </CardTitle>
          <CardDescription>أدخل بيانات حساب المالك للوصول إلى لوحة الإدارة.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="owner-login"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate();
            }}
          >
            <FieldGroup>
              <Field data-disabled={login.isPending}>
                <FieldLabel htmlFor="owner-email">البريد الإلكتروني</FieldLabel>
                <Input
                  id="owner-email"
                  type="email"
                  autoComplete="username"
                  dir="ltr"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={login.isPending}
                />
              </Field>
              <Field data-disabled={login.isPending}>
                <FieldLabel htmlFor="owner-password">كلمة المرور</FieldLabel>
                <Input
                  id="owner-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={login.isPending}
                />
              </Field>
              {login.isError && (
                <Alert variant="destructive">
                  <AlertTitle>تعذّر الدخول</AlertTitle>
                  <AlertDescription>{login.error.message}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            form="owner-login"
            disabled={login.isPending || !email || !password}
          >
            <KeyRoundIcon data-icon="inline-start" />
            {login.isPending ? "جارٍ تسجيل الدخول" : "تسجيل الدخول"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
