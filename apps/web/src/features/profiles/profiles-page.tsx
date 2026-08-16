import { accountKindLabels, accountRoleLabels } from "@arcadia/i18n";
import { GearIcon, SignOutIcon, SparkleIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { accountKeys, getFamilyAccounts } from "@/features/accounts/api";
import { authClient } from "@/lib/auth-client";

export function AccountsPage() {
  const accounts = useQuery({
    queryKey: accountKeys.family,
    queryFn: getFamilyAccounts,
  });

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/login");
  }

  return (
    <PlatformShell>
      <section className="mx-auto max-w-6xl px-5 pb-28 pt-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-5 flex size-12 items-center justify-center rounded-full border border-primary/35 bg-primary/8 text-primary">
              <UsersThreeIcon size={25} weight="duotone" />
            </div>
            <p className="text-xs font-semibold tracking-[0.18em] text-primary">مدار العائلة</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold sm:text-5xl">
              من يستكشف معنا؟
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              لكل شخص مكتبته وحدوده وانطباعاته، بينما تبقى النقاشات والنشاطات مساحة مشتركة.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link to="/settings" />}>
              <GearIcon data-icon="inline-start" />
              إعداداتي
            </Button>
            <Button variant="ghost" onClick={signOut}>
              <SignOutIcon data-icon="inline-start" />
              تبديل الحساب
            </Button>
          </div>
        </div>

        {accounts.isLoading ? (
          <p className="mt-12 text-muted-foreground">جارٍ جمع العائلة…</p>
        ) : accounts.isError ? (
          <Card className="mt-10">
            <CardHeader>
              <CardTitle>تعذّر تحميل الحسابات</CardTitle>
              <CardDescription>أعد المحاولة بعد التأكد من اتصال خادم أركاديا.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.data?.map((account) => (
              <Card
                key={account.id}
                className={
                  account.isCurrent
                    ? "relative overflow-hidden border-primary/45 bg-primary/5"
                    : "relative overflow-hidden"
                }
              >
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-l from-transparent via-primary/50 to-transparent" />
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <AccountAvatar
                      avatarKey={account.avatarKey}
                      label={`صورة ${account.displayName}`}
                      className="size-16"
                    />
                    {account.isCurrent ? (
                      <Badge>
                        <SparkleIcon data-icon="inline-start" weight="fill" />
                        أنت هنا
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="mt-3">{account.displayName}</CardTitle>
                  <CardDescription>{account.bio || "عضو في عائلة أركاديا"}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{accountKindLabels[account.kind]}</Badge>
                  <Badge variant="outline">{accountRoleLabels[account.role]}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PlatformShell>
  );
}
