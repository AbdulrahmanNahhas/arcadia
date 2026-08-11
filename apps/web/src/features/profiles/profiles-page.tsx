import { LockKeyIcon, ShieldWarningIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PlatformShell } from "@/components/platform-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type DemoProfile, demoProfiles, selectedProfileKey } from "./model";

export function ProfilesPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<DemoProfile | null>(null);
  const [pin, setPin] = useState("");
  const [invalid, setInvalid] = useState(false);
  const select = (profile: DemoProfile) => {
    if (profile.accountKind === "admin") {
      setPending(profile);
      setPin("");
      setInvalid(false);
      return;
    }
    window.localStorage.setItem(selectedProfileKey, profile.id);
    void navigate({ to: "/browse" });
  };
  const unlock = () => {
    if (pin !== "4242" || !pending) {
      setInvalid(true);
      return;
    }
    window.localStorage.setItem(selectedProfileKey, pending.id);
    setPending(null);
    void navigate({ to: "/browse" });
  };
  return (
    <PlatformShell>
      <section className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-5xl flex-col justify-center px-5 py-20">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-primary/40 text-primary">
            <UserCircleIcon />
          </div>
          <h1 className="font-heading text-3xl font-semibold sm:text-5xl">من يستكشف الليلة؟</h1>
          <p className="mt-3 text-muted-foreground">كل ملف يحمل حدوده ولغته معه إلى الكواكب.</p>
        </div>
        <Alert className="mb-8">
          <ShieldWarningIcon />
          <AlertTitle>هوية عرض تجريبي</AlertTitle>
          <AlertDescription>
            الاختيار والرقم السري محفوظان محلياً للتجربة فقط ولا يشكّلان نظام حماية.
          </AlertDescription>
        </Alert>
        <div className="grid gap-4 md:grid-cols-3">
          {demoProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => select(profile)}
              className="rounded-2xl text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition duration-300 hover:-translate-y-1 hover:ring-primary/50">
                <CardHeader>
                  <Avatar className="size-14">
                    <AvatarFallback>{profile.initials}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="mt-3">{profile.name}</CardTitle>
                  <CardDescription>{profile.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    {profile.accountKind === "admin"
                      ? "مدير"
                      : profile.accountKind === "family"
                        ? "عائلة"
                        : "فردي"}
                  </Badge>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </section>
      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>افتح ملف المدير</DialogTitle>
            <DialogDescription>
              الرقم التجريبي الموثّق هو 4242. لا يُرسل إلى API ولا يُحفظ في PostgreSQL.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor="demo-pin">الرقم التجريبي</FieldLabel>
              <Input
                id="demo-pin"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value);
                  setInvalid(false);
                }}
                aria-invalid={invalid}
                onKeyDown={(event) => {
                  if (event.key === "Enter") unlock();
                }}
              />
              <FieldDescription>
                {invalid ? "الرقم غير مطابق." : "أربع خانات للعرض المحلي."}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button onClick={unlock}>
              <LockKeyIcon data-icon="inline-start" />
              فتح الملف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlatformShell>
  );
}
