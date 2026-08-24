import { accountKindLabels, accountRoleLabels, ar } from "@arcadia/i18n";
import {
  GearIcon,
  IdentificationCardIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useCurrentAccount } from "@/features/accounts/api";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

async function signOut() {
  await authClient.signOut();
  window.location.assign("/login");
}

/**
 * Your own profile at a glance — not a family roster. Switching between family members and
 * managing their accounts is an owner/editor job that lives entirely in the admin dashboard;
 * this page only ever shows the signed-in account.
 */
export function AccountsPage() {
  const { data, isLoading } = useCurrentAccount();
  const account = data?.account;
  const canManageAccounts = account?.role === "owner" || account?.role === "editor";

  return (
    <PlatformShell>
      <section className="mx-auto max-w-3xl px-5 pb-28 pt-20">
        {isLoading || !account ? (
          <p className="text-muted-foreground">جارٍ تحميل حسابك…</p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-start">
              <AccountAvatar
                avatarKey={account.avatarKey}
                label={`صورة ${account.displayName}`}
                className="size-24 shrink-0 ring-2 ring-primary/25"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.18em] text-primary">حسابك</p>
                <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
                  {account.displayName}
                </h1>
                {account.username ? (
                  <p className="mt-1 font-mono text-sm text-muted-foreground" dir="ltr">
                    @{account.username}
                  </p>
                ) : null}
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  {account.bio || "لم تكتب نبذة عنك بعد."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge variant="secondary">{accountKindLabels[account.kind]}</Badge>
                  <Badge variant="outline">{accountRoleLabels[account.role]}</Badge>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheckIcon weight="duotone" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-base">حدود المحتوى</CardTitle>
                    <CardDescription>الجمهور والمخاطر المسموح بها لحسابك.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">جمهور {account.contentPolicy.audience}</Badge>
                  <Badge variant="outline">عمر {account.contentPolicy.age}</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <IdentificationCardIcon weight="duotone" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-base">إدارة الحساب</CardTitle>
                    <CardDescription>الصورة والتفضيلات وحدود المحتوى.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link
                    to="/settings"
                    className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                  >
                    <GearIcon data-icon="inline-start" />
                    إعداداتي
                  </Link>
                </CardContent>
              </Card>
            </div>

            {canManageAccounts ? (
              <Link
                to="/admin/accounts"
                className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <UsersThreeIcon /> إدارة حسابات العائلة كلها من لوحة الإدارة
                </span>
                <span className="text-primary">فتح لوحة الإدارة</span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-8 flex items-center gap-2 text-sm text-muted-foreground transition hover:text-destructive"
            >
              <SignOutIcon data-icon="inline-start" />
              {ar.auth.signOut}
            </button>
          </>
        )}
      </section>
    </PlatformShell>
  );
}
