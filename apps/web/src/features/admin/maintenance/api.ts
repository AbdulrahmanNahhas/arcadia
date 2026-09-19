import type { BackgroundJob, ValidationIssue } from "@arcadia/contracts";
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const maintenanceKeys = {
  all: ["admin", "maintenance"] as const,
  validation: () => [...maintenanceKeys.all, "validation"] as const,
  jobs: () => [...maintenanceKeys.all, "jobs"] as const,
  health: () => [...maintenanceKeys.all, "health"] as const,
};

export const validationQueryOptions = () =>
  queryOptions({
    queryKey: maintenanceKeys.validation(),
    queryFn: () => apiFetch<ValidationIssue[]>("/api/v1/admin/validation"),
  });

export const jobsQueryOptions = () =>
  queryOptions({
    queryKey: maintenanceKeys.jobs(),
    queryFn: () => apiFetch<BackgroundJob[]>("/api/v1/admin/archive/jobs"),
  });

export const maintenanceJobTypes = [
  "validate",
  "inspect-media",
  "purge-orphans",
  "drop-missing",
] as const;
export type MaintenanceJobType = (typeof maintenanceJobTypes)[number];

export function isMaintenanceJobType(value: string): value is MaintenanceJobType {
  return maintenanceJobTypes.some((entry) => entry === value);
}

export type JobResult = Record<string, number | string>;

export function runMaintenanceJob(type: MaintenanceJobType) {
  return apiFetch<{ id: string; result: JobResult }>("/api/v1/admin/maintenance/jobs", {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export function repairIssue(issueId: string) {
  return apiFetch<{ repaired: string }>("/api/v1/admin/maintenance/repair", {
    method: "POST",
    body: JSON.stringify({ issueId }),
  });
}

export interface AdminHealth {
  api: {
    version: string | null;
    node: string;
    uptimeSeconds: number;
    environment: string;
    mediaRoot: string;
  };
  database: {
    bytes: number;
    titles: number;
    installments: number;
    episodes: number;
    accounts: number;
    downloads: number;
    migration: { applied: number; latestAt: string | null } | null;
    lastAdminAction: string | null;
  };
  media: { assets: number; bytes: number; deletionFailures: number };
  maintenance: { lastValidate: string | null; lastInspect: string | null };
  integrations: { tmdb: boolean; fanart: boolean; streamAddon: boolean; openSubtitles: boolean };
}

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: maintenanceKeys.health(),
    queryFn: () => apiFetch<AdminHealth>("/api/v1/admin/health"),
    staleTime: 30_000,
  });

export const jobLabels = {
  validate: {
    title: "فحص البيانات",
    description: "يعيد حساب كل ملاحظات التحقق ويسجّل العدد حسب الخطورة.",
    destructive: false,
  },
  "inspect-media": {
    title: "فحص ملفات الوسائط",
    description: "يقارن كل سجل صورة بالقرص: كم ملفاً مفقوداً وكم أصلاً غير مستخدم.",
    destructive: false,
  },
  "purge-orphans": {
    title: "حذف الأصول غير المستخدمة",
    description: "يحذف كل صورة لا يشير إليها أي عمل أو شخص — السجل والملف معاً.",
    destructive: true,
  },
  "drop-missing": {
    title: "حذف سجلات الملفات المفقودة",
    description: "يحذف سجلات الصور التي اختفى ملفها من القرص، مع تعييناتها.",
    destructive: true,
  },
} satisfies Record<
  MaintenanceJobType,
  { title: string; description: string; destructive: boolean }
>;

export const jobTypeLabel = (type: string) =>
  isMaintenanceJobType(type) ? jobLabels[type].title : type === "export" ? "تصدير" : type;

export const jobStatusLabel = (status: string) => {
  switch (status) {
    case "queued":
      return "في الانتظار";
    case "running":
      return "يعمل";
    case "completed":
      return "اكتمل";
    case "failed":
      return "فشل";
    default:
      return status;
  }
};

const resultLabels = new Map<string, string>([
  ["total", "الإجمالي"],
  ["errors", "أخطاء"],
  ["warnings", "تنبيهات"],
  ["info", "ملاحظات"],
  ["autoRepairable", "قابلة للإصلاح تلقائياً"],
  ["assets", "أصول"],
  ["missing", "مفقودة"],
  ["orphans", "غير مستخدمة"],
  ["bytes", "بايت"],
  ["candidates", "مرشّحة"],
  ["removed", "حُذفت"],
  ["checked", "فُحصت"],
  ["note", "ملاحظة"],
]);

export function describeJobResult(result: BackgroundJob["result"] | JobResult): string {
  if (!result) return "";
  return Object.entries(result)
    .map(([key, value]) => {
      const shown =
        Number.isFinite(Number(value)) && value !== ""
          ? Number(value).toLocaleString("ar")
          : String(value);
      return `${resultLabels.get(key) ?? key}: ${shown}`;
    })
    .join(" · ");
}
