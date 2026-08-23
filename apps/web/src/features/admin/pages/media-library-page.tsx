import type { MediaAsset } from "@arcadia/contracts";
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  ClipboardIcon,
  EyeIcon,
  FileImageIcon,
  ImagesIcon,
  LinkBreakIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  deleteMediaAsset,
  getMediaAssets,
  removeMediaAssignment,
  updateMediaFocal,
} from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const roleLabels = {
  poster: "ملصق",
  banner: "غلاف",
  logo: "شعار",
  profile: "صورة شخصية",
} as const;

type Assignment = MediaAsset["assignments"][number];
type PendingAction =
  | { kind: "delete-asset"; asset: MediaAsset }
  | { kind: "unlink"; asset: MediaAsset; assignment: Assignment };

/** `Slider`'s `onValueChange` reports `number | number[]` depending on whether it's a
 *  single-thumb or range slider — narrows down to the single-thumb case used below. */
function isSingleSliderValue(value: number | readonly number[]): value is number {
  return typeof value === "number";
}

function formatBytes(value: number) {
  const units = ["B", "KiB", "MiB", "GiB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(amount)} ${units[unit]}`;
}

function HealthBadge({ asset }: { asset: MediaAsset }) {
  if (asset.health === "missing") return <Badge variant="destructive">مفقود من القرص</Badge>;
  if (asset.health === "deletion-failed") return <Badge variant="destructive">فشل الحذف</Badge>;
  if (asset.usageCount > 1) return <Badge variant="secondary">مستخدم عدة مرات</Badge>;
  if (asset.usageCount === 0) return <Badge variant="outline">غير مستخدم</Badge>;
  return <Badge variant="secondary">سليم</Badge>;
}

export function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("all");
  const [role, setRole] = useState("all");
  const [details, setDetails] = useState<MediaAsset | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const search = new URLSearchParams({ limit: "100" });
  if (query.trim()) search.set("q", query.trim());
  if (health !== "all") search.set("health", health);
  if (role !== "all") search.set("role", role);
  const queryString = search.toString();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-media-assets", query, health, role],
    queryFn: () => getMediaAssets(`?${queryString}`),
  });

  const summary = useMemo(
    () => ({
      missing: data.items.filter((asset) => asset.health === "missing").length,
      unused: data.items.filter((asset) => asset.usageCount === 0).length,
      reused: data.items.filter((asset) => asset.usageCount > 1).length,
      size: data.items.reduce((total, asset) => total + asset.byteSize, 0),
    }),
    [data.items],
  );

  const action = useMutation({
    mutationFn: async (value: PendingAction) => {
      if (value.kind === "delete-asset") {
        return deleteMediaAsset({ data: { assetId: value.asset.id } });
      }
      return removeMediaAssignment({ data: { assignmentId: value.assignment.id } });
    },
    onSuccess: async (_, value) => {
      setFeedback(
        value.kind === "delete-asset"
          ? "حُذف سجل الأصل من المكتبة."
          : `أُلغي تعيين «${value.assignment.ownerLabel}».`,
      );
      setPendingAction(null);
      setDetails(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-media-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["catalog-validation"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
    },
  });

  const focalMutation = useMutation({
    mutationFn: (value: { assetId: string; focalX: number; focalY: number }) =>
      updateMediaFocal({ data: value }),
    onSuccess: async (_, value) => {
      setDetails((current) =>
        current?.id === value.assetId
          ? { ...current, focalX: value.focalX, focalY: value.focalY }
          : current,
      );
      setFeedback("حُفظ موضع التركيز للصورة.");
      await queryClient.invalidateQueries({ queryKey: ["admin-media-assets"] });
    },
  });

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setFeedback(`نُسخ ${label}.`);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-12">
      <AdminPageHeader
        title="مكتبة الوسائط"
        description="افحص ملفات الصور وتعييناتها، نظّف السجلات اليتيمة، وتتبّع كل موضع استخدام قبل الفصل أو الحذف."
      />

      <div className="flex min-w-0 flex-col gap-5 px-5 sm:px-6">
        {feedback ? (
          <Alert>
            <CheckCircleIcon />
            <AlertTitle>تم الإجراء</AlertTitle>
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="النتائج" value={String(data.total)} detail="أصل مطابق" />
          <SummaryCard
            label="بحاجة لتنظيف"
            value={String(summary.unused)}
            detail={`${summary.missing} ملف مفقود`}
            danger={summary.missing > 0}
          />
          <SummaryCard label="إعادة الاستخدام" value={String(summary.reused)} detail="أصل مشترك" />
          <SummaryCard
            label="الحجم الظاهر"
            value={formatBytes(summary.size)}
            detail="ضمن النتائج"
          />
        </div>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>البحث والتصفية</CardTitle>
            <CardDescription>
              اعرض الأصول المفقودة أو غير المستخدمة مباشرة، أو ابحث بالاسم وبصمة SHA-256.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_13rem]">
            <InputGroup className="min-w-0">
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="اسم الملف أو البصمة"
                aria-label="البحث في الوسائط"
              />
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
            </InputGroup>
            <Select value={health} onValueChange={(value) => setHealth(value ?? "all")}>
              <SelectTrigger aria-label="حالة الوسائط">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="healthy">سليم على القرص</SelectItem>
                  <SelectItem value="unused">غير مستخدم</SelectItem>
                  <SelectItem value="reused">معاد الاستخدام</SelectItem>
                  <SelectItem value="missing">ملف مفقود</SelectItem>
                  <SelectItem value="oversized">أكبر من 10 MiB</SelectItem>
                  <SelectItem value="deletion-failed">فشل الحذف</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(value) => setRole(value ?? "all")}>
              <SelectTrigger aria-label="دور الوسائط">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">كل الأدوار</SelectItem>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {data.items.length ? (
          <div className="grid min-w-0 gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {data.items.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onInspect={() => setDetails(asset)}
                onDelete={() => setPendingAction({ kind: "delete-asset", asset })}
                onCopy={copy}
              />
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImagesIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد أصول مطابقة</EmptyTitle>
              <EmptyDescription>
                غيّر البحث أو المرشحات، أو ارفع صورة من محرر العمل.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      <AssetDetailsDialog
        asset={details}
        onOpenChange={(open) => !open && setDetails(null)}
        onCopy={copy}
        onUnlink={(asset, assignment) => setPendingAction({ kind: "unlink", asset, assignment })}
        onDelete={(asset) => setPendingAction({ kind: "delete-asset", asset })}
        onFocalChange={(asset, focalX, focalY) =>
          focalMutation.mutate({ assetId: asset.id, focalX, focalY })
        }
      />
      <ActionDialog
        action={pendingAction}
        pending={action.isPending}
        error={action.error?.message}
        onOpenChange={(open) => !open && setPendingAction(null)}
        onConfirm={() => pendingAction && action.mutate(pendingAction)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <Card size="sm" className="gap-2 py-4 shadow-none">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={danger ? "text-destructive" : undefined}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

function AssetCard({
  asset,
  onInspect,
  onDelete,
  onCopy,
}: {
  asset: MediaAsset;
  onInspect: () => void;
  onDelete: () => void;
  onCopy: (value: string, label: string) => void;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="relative aspect-video bg-muted">
        {asset.health === "missing" ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-destructive">
            <FileImageIcon className="size-8" />
            <span className="text-sm">سجل بلا ملف على القرص</span>
          </div>
        ) : (
          <img
            src={asset.path}
            alt={asset.originalFilename}
            className="size-full object-contain"
            loading="lazy"
          />
        )}
        <div className="absolute inset-e-3 top-3">
          <HealthBadge asset={asset} />
        </div>
      </div>
      <CardHeader className="min-w-0">
        <CardTitle className="truncate text-base" dir="ltr" title={asset.originalFilename}>
          {asset.originalFilename}
        </CardTitle>
        <CardDescription className="truncate font-mono" dir="ltr" title={asset.sha256}>
          {asset.sha256.slice(0, 20)}…
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <Metric label="الأبعاد" value={`${asset.width}×${asset.height}`} />
          <Metric label="الحجم" value={formatBytes(asset.byteSize)} />
          <Metric label="الاستخدام" value={String(asset.usageCount)} />
        </dl>
        {asset.assignments.length ? (
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <ArrowClockwiseIcon className="shrink-0" />
            <span className="truncate">{asset.assignments[0]?.ownerLabel}</span>
            {asset.assignments.length > 1 ? (
              <Badge variant="outline">+{asset.assignments.length - 1}</Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">غير معيّن؛ يمكن تنظيف سجله بأمان.</p>
        )}
        {asset.deletionError ? (
          <p className="flex min-w-0 items-start gap-2 text-sm text-destructive">
            <WarningIcon className="mt-0.5 shrink-0" />
            <span className="wrap-break-word">{asset.deletionError}</span>
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t">
        <Button size="sm" variant="outline" onClick={onInspect}>
          <EyeIcon data-icon="inline-start" /> التفاصيل والإسنادات
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onCopy(asset.path, "المسار")}>
          <ClipboardIcon data-icon="inline-start" /> نسخ المسار
        </Button>
        {asset.usageCount === 0 ? (
          <Button size="sm" variant="destructive" className="ms-auto" onClick={onDelete}>
            <TrashIcon data-icon="inline-start" />
            {asset.health === "missing" ? "حذف السجل" : "حذف الأصل"}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono" dir="ltr" title={value}>
        {value}
      </dd>
    </div>
  );
}

function AssetDetailsDialog({
  asset,
  onOpenChange,
  onCopy,
  onUnlink,
  onDelete,
  onFocalChange,
}: {
  asset: MediaAsset | null;
  onOpenChange: (open: boolean) => void;
  onCopy: (value: string, label: string) => void;
  onUnlink: (asset: MediaAsset, assignment: Assignment) => void;
  onDelete: (asset: MediaAsset) => void;
  onFocalChange: (asset: MediaAsset, focalX: number, focalY: number) => void;
}) {
  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="min-w-0 overflow-hidden sm:max-w-2xl">
        {asset ? (
          <>
            <DialogHeader className="min-w-0 text-right">
              <DialogTitle className="truncate" dir="ltr" title={asset.originalFilename}>
                {asset.originalFilename}
              </DialogTitle>
              <DialogDescription>
                افحص البيانات التقنية وكل إسناد قبل تنفيذ أي إجراء.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-w-0 gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                {asset.health === "missing" ? (
                  <div className="flex size-full items-center justify-center text-destructive">
                    <FileImageIcon className="size-9" />
                  </div>
                ) : (
                  <img src={asset.path} alt="" className="size-full object-contain" />
                )}
              </div>
              <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                <TechnicalField label="الحالة" value={asset.health} />
                <TechnicalField label="MIME" value={asset.mimeType} />
                <TechnicalField label="الأبعاد" value={`${asset.width}×${asset.height}`} />
                <TechnicalField label="الحجم" value={formatBytes(asset.byteSize)} />
                <TechnicalField label="المسار" value={asset.path} wide />
                <TechnicalField label="SHA-256" value={asset.sha256} wide />
              </dl>
            </div>
            <FocalPointEditor asset={asset} onSave={(x, y) => onFocalChange(asset, x, y)} />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">مواضع الاستخدام ({asset.assignments.length})</h3>
              {asset.assignments.length ? (
                <div className="max-h-56 space-y-2 overflow-y-auto pe-1">
                  {asset.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border p-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {assignment.ownerLabel}
                      </span>
                      <Badge variant="outline">{roleLabels[assignment.role]}</Badge>
                      {assignment.isPrimary ? <Badge>أساسي</Badge> : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => onUnlink(asset, assignment)}
                      >
                        <LinkBreakIcon data-icon="inline-start" /> فصل
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  لا يستخدم أي سجل هذا الأصل. حذفه من المكتبة آمن.
                </p>
              )}
            </div>
            <DialogFooter className="flex-wrap">
              <Button variant="outline" onClick={() => onCopy(asset.sha256, "البصمة")}>
                <ClipboardIcon data-icon="inline-start" /> نسخ البصمة
              </Button>
              <Button variant="outline" onClick={() => onCopy(asset.path, "المسار")}>
                <ClipboardIcon data-icon="inline-start" /> نسخ المسار
              </Button>
              {asset.usageCount === 0 ? (
                <Button variant="destructive" onClick={() => onDelete(asset)}>
                  <TrashIcon data-icon="inline-start" />
                  {asset.health === "missing" ? "حذف السجل" : "حذف الأصل"}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FocalPointEditor({
  asset,
  onSave,
}: {
  asset: MediaAsset;
  onSave: (x: number, y: number) => void;
}) {
  const [x, setX] = useState(asset.focalX);
  const [y, setY] = useState(asset.focalY);
  useEffect(() => {
    setX(asset.focalX);
    setY(asset.focalY);
  }, [asset.focalX, asset.focalY]);
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">موضع التركيز</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            يحافظ على الوجه أو الشعار داخل القصّات المختلفة.
          </p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {x}% × {y}%
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2 text-xs">
          <span>أفقي</span>
          <Slider
            aria-label="موضع التركيز الأفقي"
            value={[x]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => setX(isSingleSliderValue(value) ? value : (value[0] ?? 50))}
          />
        </div>
        <div className="space-y-2 text-xs">
          <span>عمودي</span>
          <Slider
            aria-label="موضع التركيز العمودي"
            value={[y]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => setY(isSingleSliderValue(value) ? value : (value[0] ?? 50))}
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => onSave(x, y)}>
          حفظ
        </Button>
      </div>
    </div>
  );
}

function TechnicalField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-xs" dir="ltr" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ActionDialog({
  action,
  pending,
  error,
  onOpenChange,
  onConfirm,
}: {
  action: PendingAction | null;
  pending: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const deletingAsset = action?.kind === "delete-asset";
  return (
    <Dialog open={Boolean(action)} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>
            {deletingAsset ? "حذف الأصل من المكتبة؟" : "فصل موضع الاستخدام؟"}
          </DialogTitle>
          <DialogDescription>
            {action?.kind === "delete-asset"
              ? action.asset.health === "missing"
                ? "الملف غير موجود أصلاً على القرص. سيُحذف السجل القديم من قاعدة البيانات وتتوقف ملاحظة «مفقود» عن الظهور."
                : "سيُحذف سجل الأصل وملفه المُدار. هذا الخيار متاح فقط عندما لا توجد إسنادات."
              : action
                ? `سيُفصل الأصل عن «${action.assignment.ownerLabel}». إذا كان هذا آخر استخدام لملف مرفوع ومُدار فقد يُحذف الملف أيضاً.`
                : ""}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <WarningIcon />
            <AlertTitle>تعذّر تنفيذ الإجراء</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {deletingAsset ? (
              <TrashIcon data-icon="inline-start" />
            ) : (
              <LinkBreakIcon data-icon="inline-start" />
            )}
            {pending ? "جارٍ التنفيذ…" : deletingAsset ? "حذف" : "فصل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
