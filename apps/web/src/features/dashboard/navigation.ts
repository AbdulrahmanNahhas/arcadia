import {
  ActivityIcon,
  ArchiveIcon,
  ArrowDownToLineIcon,
  BracesIcon,
  DownloadIcon,
  HardDriveIcon,
  ImagesIcon,
  LayersIcon,
  ListChecksIcon,
  MonitorIcon,
  PlugIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TablePropertiesIcon,
  UsersIcon,
} from "lucide-react";

export const serverSections = [
  {
    slug: "downloads",
    title: "التنزيلات",
    description: "طلبات التنزيل، الطابور، وإعادة المحاولة.",
    icon: DownloadIcon,
    columns: ["المهمة", "الوجهة", "الحالة", "التقدم", "السرعة"],
  },
  {
    slug: "library",
    title: "مكتبة الملفات",
    description: "المجلدات والملفات وتوفرها للمشاهدة عبر Jellyfin.",
    icon: HardDriveIcon,
    columns: ["الملف", "العمل", "النوع", "المسار", "الحالة"],
  },
  {
    slug: "accounts",
    title: "المستخدمون",
    description: "هويات تسجيل الدخول، الدعوات، والأدوار والصلاحيات.",
    icon: UsersIcon,
    columns: ["المستخدم", "الدور", "الحالة", "آخر دخول"],
  },
  {
    slug: "profiles",
    title: "ملفات المشاهدة",
    description: "التقدم والتفضيلات والتصنيف المسموح لكل ملف.",
    icon: LayersIcon,
    columns: ["الملف", "المستخدم", "السياسة", "آخر نشاط"],
  },
  {
    slug: "policies",
    title: "السياسات والصلاحيات",
    description: "حدود المحتوى، صلاحيات التحرير، وسياسات المكتبات.",
    icon: ShieldCheckIcon,
    columns: ["السياسة", "النطاق", "الملفات", "آخر تعديل"],
  },
  {
    slug: "devices",
    title: "الأجهزة",
    description: "تسجيل الأجهزة، الجلسات، الإصدارات، وحالة المزامنة.",
    icon: MonitorIcon,
    columns: ["الجهاز", "المستخدم", "المنصة", "الإصدار", "آخر مزامنة"],
  },
  {
    slug: "jobs",
    title: "المهام",
    description: "الاستيراد، فحص الوسائط، التنزيلات، والمهام الخلفية.",
    icon: ListChecksIcon,
    columns: ["المهمة", "النوع", "الحالة", "بدأت", "النتيجة"],
  },
  {
    slug: "logs",
    title: "السجلات",
    description: "الأحداث والأخطاء وسجل التشغيل في مكان واحد.",
    icon: ScrollTextIcon,
    columns: ["الوقت", "المستوى", "الخدمة", "الحدث"],
  },
  {
    slug: "backups",
    title: "النسخ والاستعادة",
    description: "نسخ قاعدة البيانات والصور والتحقق من قابلية الاستعادة.",
    icon: ArchiveIcon,
    columns: ["النسخة", "المحتوى", "الحجم", "التحقق", "التاريخ"],
  },
  {
    slug: "updates",
    title: "التحديثات",
    description: "إصدارات الخادم والتطبيقات، التحديث، وخيارات الرجوع.",
    icon: RefreshCwIcon,
    columns: ["المكوّن", "الإصدار الحالي", "المتاح", "الحالة"],
  },
  {
    slug: "integrations",
    title: "الخدمات المتصلة",
    description: "TMDB وFanart وOpenSubtitles وJellyfin ومصادر التشغيل.",
    icon: PlugIcon,
    columns: ["الخدمة", "الوظيفة", "الاتصال", "آخر فحص"],
  },
  {
    slug: "statistics",
    title: "الإحصاءات",
    description: "تغطية البيانات، استخدام المكتبة، وصحة التحرير.",
    icon: ActivityIcon,
    columns: ["المؤشر", "القيمة", "النطاق", "آخر تحديث"],
  },
  {
    slug: "settings",
    title: "الإعدادات",
    description: "إعدادات الخادم والمكتبة والمظهر والسلوك.",
    icon: SettingsIcon,
    columns: ["الإعداد", "القيمة", "النطاق"],
  },
] as const;

export const databaseTools = [
  { slug: "images", title: "مكتبة الصور", icon: ImagesIcon },
  { slug: "imports", title: "TMDB وFanart", icon: ArrowDownToLineIcon },
  { slug: "json", title: "محرر JSON", icon: BracesIcon },
  { slug: "validation", title: "التحقق والصيانة", icon: ListChecksIcon },
  { slug: "revisions", title: "السجل وسلة المحذوفات", icon: ScrollTextIcon },
  { slug: "tables", title: "جميع الجداول", icon: TablePropertiesIcon },
] as const;

export function serverSectionFor(slug: string) {
  return serverSections.find((section) => section.slug === slug);
}
