import type {
  AccountCapability,
  AccountKind,
  AccountPolicyPreview,
  AccountRestrictionEditor,
  AccountRole,
  AccountStatus,
  AvatarKey,
  CreateAccountInput,
} from "@arcadia/contracts";
import type { Classification } from "@arcadia/domain";
import {
  accountCapabilityLabels,
  accountKindLabels,
  accountRoleLabels,
  accountStatusLabels,
  ageOptions,
  audienceOptions,
  avatarLabels,
  riskOptions,
} from "@arcadia/i18n";
import {
  CopyIcon,
  LinkIcon,
  PlusIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import {
  accountKeys,
  createAccountInvite,
  createAdminAccount,
  getAccountRestrictions,
  getAdminAccounts,
  updateAdminAccount,
} from "@/features/accounts/api";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "../components/admin-page-header";

const allCapabilities = Object.keys(accountCapabilityLabels) as AccountCapability[];
const avatarKeys = Object.keys(avatarLabels) as AvatarKey[];
const createDefaults: CreateAccountInput = {
  username: "",
  password: "",
  displayName: "",
  kind: "personal",
  role: "member",
  avatarKey: "orbit-2",
  capabilities: ["catalog.view"],
};

type EditDraft = {
  displayName: string;
  kind: AccountKind;
  role: AccountRole;
  status: AccountStatus;
  avatarKey: AvatarKey;
  capabilities: AccountCapability[];
  contentPolicy: Classification;
  adminRestrictions: Classification;
  blockedTitleIds: string[];
  blockedTagIds: string[];
  blockedGenreIds: string[];
  blockedEntityIds: string[];
  blockedPlanetIds: string[];
};

export function AdminAccountsPage() {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: accountKeys.admin, queryFn: getAdminAccounts });
  const [createMode, setCreateMode] = useState<"account" | "invite" | null>(null);
  const [editing, setEditing] = useState<AccountPolicyPreview | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const activeCount = accounts.data?.filter((account) => account.status === "active").length ?? 0;
  const editorCount = accounts.data?.filter((account) => account.role !== "member").length ?? 0;
  const hiddenCount =
    accounts.data?.reduce(
      (sum, account) =>
        sum +
        account.titleBlockCount +
        account.tagBlockCount +
        account.genreBlockCount +
        account.entityBlockCount +
        account.planetBlockCount,
      0,
    ) ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminPageHeader
        title="الحسابات والسياسات"
        description="أنشئ حسابات مستقلة، فوّض صلاحيات دقيقة، واضبط حدود الظهور المخفية من شاشة واحدة."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCreateMode("invite")}>
              <LinkIcon data-icon="inline-start" /> دعوة
            </Button>
            <Button onClick={() => setCreateMode("account")}>
              <UserPlusIcon data-icon="inline-start" /> حساب جديد
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 px-6 sm:grid-cols-3">
        <Metric label="الحسابات النشطة" value={activeCount} />
        <Metric label="المالكون والمحرّرون" value={editorCount} />
        <Metric label="قواعد الإخفاء الصريحة" value={hiddenCount} />
      </div>

      <div className="grid gap-5 px-6 pb-12 xl:grid-cols-3">
        {accounts.data?.map((account) => (
          <Card key={account.id} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <AccountAvatar
                  avatarKey={account.avatarKey}
                  label={`صورة ${account.displayName}`}
                  className="size-14"
                />
                <Badge variant={account.status === "active" ? "secondary" : "outline"}>
                  {accountStatusLabels[account.status]}
                </Badge>
              </div>
              <CardTitle className="mt-3">{account.displayName}</CardTitle>
              <CardDescription dir="ltr" className="text-start">
                @{account.username ?? "—"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge>{accountRoleLabels[account.role]}</Badge>
                <Badge variant="outline">{accountKindLabels[account.kind]}</Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                <SmallMetric label="أعمال" value={account.titleBlockCount} />
                <SmallMetric
                  label="وسوم وأنواع"
                  value={account.tagBlockCount + account.genreBlockCount}
                />
                <SmallMetric label="أشخاص/استوديو" value={account.entityBlockCount} />
                <SmallMetric label="كواكب" value={account.planetBlockCount} />
              </div>
              <Button className="mt-5 w-full" variant="outline" onClick={() => setEditing(account)}>
                <SlidersHorizontalIcon data-icon="inline-start" /> إدارة كاملة
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateAccountDialog
        mode={createMode}
        onOpenChange={(open) => {
          if (!open) setCreateMode(null);
        }}
        onCreated={async (url) => {
          setInviteUrl(url);
          await queryClient.invalidateQueries({ queryKey: accountKeys.admin });
        }}
      />
      <EditAccountDialog
        account={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <Dialog open={Boolean(inviteUrl)} onOpenChange={(open) => !open && setInviteUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رابط الدعوة جاهز</DialogTitle>
            <DialogDescription>
              يظهر الرابط مرة واحدة. أرسله إلى عضو العائلة بأمان.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2" dir="ltr">
            <Input readOnly value={inviteUrl ?? ""} />
            <Button
              size="icon"
              variant="outline"
              aria-label="نسخ رابط الدعوة"
              onClick={() => inviteUrl && navigator.clipboard.writeText(inviteUrl)}
            >
              <CopyIcon />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/55 p-3">
      <div className="font-mono text-lg">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function CreateAccountDialog({
  mode,
  onOpenChange,
  onCreated,
}: {
  mode: "account" | "invite" | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (inviteUrl: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CreateAccountInput>(createDefaults);
  const createAccount = useMutation({
    mutationFn: createAdminAccount,
    onSuccess: async () => {
      await onCreated(null);
      onOpenChange(false);
      setDraft(createDefaults);
    },
  });
  const createInvite = useMutation({
    mutationFn: createAccountInvite,
    onSuccess: async (result) => {
      await onCreated(result.inviteUrl);
      onOpenChange(false);
      setDraft(createDefaults);
    },
  });
  const pending = createAccount.isPending || createInvite.isPending;
  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "invite" ? "دعوة عضو للعائلة" : "إنشاء حساب مباشر"}</DialogTitle>
          <DialogDescription>
            {mode === "invite"
              ? "سيختار العضو كلمة مروره عند فتح الرابط."
              : "أنشئ بيانات دخول مؤقتة وسلّمها للعضو مباشرة."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="الاسم الظاهر"
              value={draft.displayName}
              onChange={(displayName) => setDraft({ ...draft, displayName })}
            />
            <TextField
              label="اسم المستخدم"
              value={draft.username}
              dir="ltr"
              onChange={(username) => setDraft({ ...draft, username })}
            />
            {mode === "account" ? (
              <TextField
                label="كلمة المرور المؤقتة"
                value={draft.password}
                type="password"
                dir="ltr"
                onChange={(password) => setDraft({ ...draft, password })}
              />
            ) : null}
            <EnumSelect
              label="نوع الحساب"
              value={draft.kind}
              options={Object.entries(accountKindLabels)}
              onChange={(kind) => setDraft({ ...draft, kind: kind as AccountKind })}
            />
            <EnumSelect
              label="الدور"
              value={draft.role}
              options={Object.entries(accountRoleLabels)}
              onChange={(role) => setDraft({ ...draft, role: role as AccountRole })}
            />
          </div>
          <AvatarPicker
            value={draft.avatarKey}
            onChange={(avatarKey) => setDraft({ ...draft, avatarKey })}
          />
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={
              pending ||
              draft.displayName.trim().length < 2 ||
              !/^[a-zA-Z0-9_]{3,30}$/.test(draft.username) ||
              (mode === "account" && draft.password.length < 8)
            }
            onClick={() => {
              if (mode === "invite") {
                const { password: _, ...invite } = draft;
                createInvite.mutate({ ...invite, expiresInHours: 72 });
              } else createAccount.mutate(draft);
            }}
          >
            <PlusIcon data-icon="inline-start" />
            {pending ? "جارٍ الإنشاء…" : mode === "invite" ? "إنشاء الرابط" : "إنشاء الحساب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAccountDialog({
  account,
  onOpenChange,
}: {
  account: AccountPolicyPreview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const restrictions = useQuery({
    queryKey: ["admin", "account", account?.id, "restrictions"],
    queryFn: () => getAccountRestrictions(account?.id ?? ""),
    enabled: Boolean(account),
  });
  const [draft, setDraft] = useState<EditDraft | null>(null);
  useEffect(() => {
    if (!account) {
      setDraft(null);
      return;
    }
    setDraft({
      displayName: account.displayName,
      kind: account.kind,
      role: account.role,
      status: account.status,
      avatarKey: account.avatarKey,
      capabilities: account.capabilities,
      contentPolicy: account.contentPolicy,
      adminRestrictions: account.adminRestrictions,
      blockedTitleIds: [],
      blockedTagIds: [],
      blockedGenreIds: [],
      blockedEntityIds: [],
      blockedPlanetIds: [],
    });
  }, [account]);
  useEffect(() => {
    if (!restrictions.data) return;
    setDraft((current) =>
      current ? { ...current, ...restrictionSelections(restrictions.data) } : current,
    );
  }, [restrictions.data]);
  const save = useMutation({
    mutationFn: async () => {
      if (!account || !draft) throw new Error("Missing account draft");
      return updateAdminAccount(account.id, draft);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.admin });
      await queryClient.invalidateQueries({ queryKey: accountKeys.family });
      onOpenChange(false);
    },
  });
  if (!draft) return null;
  return (
    <Dialog open={Boolean(account)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <AccountAvatar avatarKey={draft.avatarKey} label={draft.displayName} />
            إدارة {draft.displayName}
          </DialogTitle>
          <DialogDescription>
            الحدود الإدارية سرية؛ يرى العضو فقط أن تجربة العائلة محمية تلقائياً.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="identity">
          <TabsList>
            <TabsTrigger value="identity">الهوية</TabsTrigger>
            <TabsTrigger value="policy">حدود المخاطر</TabsTrigger>
            <TabsTrigger value="hidden">الإخفاء الصريح</TabsTrigger>
            <TabsTrigger value="capabilities">الصلاحيات</TabsTrigger>
          </TabsList>
          <TabsContent value="identity" className="pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="الاسم الظاهر"
                value={draft.displayName}
                onChange={(displayName) => setDraft({ ...draft, displayName })}
              />
              <EnumSelect
                label="الحالة"
                value={draft.status}
                options={Object.entries(accountStatusLabels)}
                onChange={(status) => setDraft({ ...draft, status: status as AccountStatus })}
              />
              <EnumSelect
                label="نوع الحساب"
                value={draft.kind}
                options={Object.entries(accountKindLabels)}
                onChange={(kind) => setDraft({ ...draft, kind: kind as AccountKind })}
              />
              <EnumSelect
                label="الدور"
                value={draft.role}
                options={Object.entries(accountRoleLabels)}
                onChange={(role) => setDraft({ ...draft, role: role as AccountRole })}
              />
            </div>
            <AvatarPicker
              value={draft.avatarKey}
              onChange={(avatarKey) => setDraft({ ...draft, avatarKey })}
            />
          </TabsContent>
          <TabsContent value="policy" className="grid gap-5 pt-5 lg:grid-cols-2">
            <PolicyEditor
              title="الحد الذي يختاره العضو"
              description="يستطيع العضو جعله أكثر تحفظاً من إعداداته."
              value={draft.contentPolicy}
              onChange={(contentPolicy) => setDraft({ ...draft, contentPolicy })}
            />
            <PolicyEditor
              title="الحد الإداري المخفي"
              description="يُدمج سراً مع اختيار العضو ويطبّق الأشد."
              value={draft.adminRestrictions}
              onChange={(adminRestrictions) => setDraft({ ...draft, adminRestrictions })}
              hidden
            />
          </TabsContent>
          <TabsContent value="hidden" className="pt-5">
            {restrictions.isLoading || !restrictions.data ? (
              <p className="text-muted-foreground">جارٍ تحميل خيارات الإخفاء…</p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <RestrictionList
                  title="الأعمال"
                  options={restrictions.data.options.titles}
                  selected={draft.blockedTitleIds}
                  onChange={(blockedTitleIds) => setDraft({ ...draft, blockedTitleIds })}
                />
                <RestrictionList
                  title="الوسوم"
                  options={restrictions.data.options.tags}
                  selected={draft.blockedTagIds}
                  onChange={(blockedTagIds) => setDraft({ ...draft, blockedTagIds })}
                />
                <RestrictionList
                  title="الأنواع"
                  options={restrictions.data.options.genres}
                  selected={draft.blockedGenreIds}
                  onChange={(blockedGenreIds) => setDraft({ ...draft, blockedGenreIds })}
                />
                <RestrictionList
                  title="الأشخاص والاستوديوهات"
                  options={restrictions.data.options.entities}
                  selected={draft.blockedEntityIds}
                  onChange={(blockedEntityIds) => setDraft({ ...draft, blockedEntityIds })}
                />
                <RestrictionList
                  title="الكواكب"
                  options={restrictions.data.options.planets}
                  selected={draft.blockedPlanetIds}
                  onChange={(blockedPlanetIds) => setDraft({ ...draft, blockedPlanetIds })}
                />
              </div>
            )}
          </TabsContent>
          <TabsContent value="capabilities" className="pt-5">
            <Card>
              <CardHeader>
                <CardTitle>تفويض المحرّر</CardTitle>
                <CardDescription>
                  دور المالك يتجاوز القائمة. دور المحرّر لا يصل إلا إلى الأدوات المحددة.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {allCapabilities.map((capability) => {
                  const checkboxId = `capability-${capability}`;
                  return (
                    <label
                      key={capability}
                      htmlFor={checkboxId}
                      className="flex items-center gap-3 rounded-xl border p-3"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={draft.capabilities.includes(capability)}
                        onCheckedChange={(checked) =>
                          setDraft({
                            ...draft,
                            capabilities: checked
                              ? [...new Set([...draft.capabilities, capability])]
                              : draft.capabilities.filter((item) => item !== capability),
                          })
                        }
                      />
                      <span className="text-sm">{accountCapabilityLabels[capability]}</span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <ShieldCheckIcon data-icon="inline-start" />
            {save.isPending ? "جارٍ الحفظ…" : "حفظ كل التغييرات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function restrictionSelections(data: AccountRestrictionEditor) {
  return {
    blockedTitleIds: data.blockedTitleIds,
    blockedTagIds: data.blockedTagIds,
    blockedGenreIds: data.blockedGenreIds,
    blockedEntityIds: data.blockedEntityIds,
    blockedPlanetIds: data.blockedPlanetIds,
  };
}

function PolicyEditor({
  title,
  description,
  value,
  onChange,
  hidden = false,
}: {
  title: string;
  description: string;
  value: Classification;
  onChange: (value: Classification) => void;
  hidden?: boolean;
}) {
  const fields = [
    ["audience", "الجمهور", audienceOptions],
    ["age", "العمر", ageOptions],
    ["sexuality", "المحتوى الجنسي", riskOptions],
    ["behavioral", "السلوك والعنف", riskOptions],
    ["theology", "الدين والغيبيات", riskOptions],
  ] as const;
  return (
    <Card className={hidden ? "border-amber-500/30 bg-amber-500/5" : undefined}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {fields.map(([key, label, options]) => (
          <EnumSelect
            key={key}
            label={label}
            value={value[key]}
            options={options}
            onChange={(next) => onChange({ ...value, [key]: next })}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function RestrictionList({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: AccountRestrictionEditor["options"]["titles"];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{selected.length} مخفي</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`ابحث في ${title}`}
          className="mb-3"
        />
        <div className="max-h-56 space-y-1 overflow-y-auto pe-1">
          {visible.map((option) => {
            const checkboxId = `restriction-${title}-${option.id}`;
            return (
              <label
                key={option.id}
                htmlFor={checkboxId}
                className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted"
              >
                <Checkbox
                  id={checkboxId}
                  checked={selected.includes(option.id)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...new Set([...selected, option.id])]
                        : selected.filter((id) => id !== option.id),
                    )
                  }
                />
                <span className="min-w-0 text-sm">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AvatarPicker({
  value,
  onChange,
}: {
  value: AvatarKey;
  onChange: (value: AvatarKey) => void;
}) {
  return (
    <Field>
      <FieldLabel>صورة الحساب</FieldLabel>
      <div className="grid grid-cols-5 gap-2">
        {avatarKeys.map((avatarKey) => (
          <button
            key={avatarKey}
            type="button"
            onClick={() => onChange(avatarKey)}
            className={cn(
              "rounded-xl border p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              avatarKey === value && "border-primary bg-primary/8",
            )}
          >
            <AccountAvatar
              avatarKey={avatarKey}
              label={avatarLabels[avatarKey]}
              className="mx-auto"
            />
          </button>
        ))}
      </div>
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        dir={dir}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function EnumSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => onChange(next as string)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([option, text]) => (
              <SelectItem key={option} value={option}>
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
