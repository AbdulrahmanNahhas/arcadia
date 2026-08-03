"use client";

import {
  ChartBarIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardTextIcon,
  DatabaseIcon,
  HeartIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { kindLabels } from "../filtering";
import type { Work } from "../model";
import { personalStatuses, workKinds } from "../model";
import { statusLabelsAr, useArabicTranslations } from "../translations";

type CountItem = {
  label: string;
  count: number;
  percentage: number;
};

type CoverageItem = CountItem & {
  description: string;
};

type CoverageGroup = {
  id: string;
  title: string;
  description: string;
  items: CoverageItem[];
};

type CopiedPrompt = string | null;

function percentage(count: number, total: number) {
  return Math.round((count / Math.max(1, total)) * 100);
}

function distribution(
  values: Array<string | null | undefined>,
  total = values.length,
): CountItem[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: percentage(count, total),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function taxonomyDistribution(works: Work[], select: (work: Work) => string[]) {
  const counts = new Map<string, number>();

  for (const work of works) {
    for (const value of new Set(select(work))) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: percentage(count, works.length),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function makeCoverageItem(
  works: Work[],
  label: string,
  description: string,
  isPresent: (work: Work) => boolean,
): CoverageItem {
  const count = works.filter(isPresent).length;
  return {
    label,
    description,
    count,
    percentage: percentage(count, works.length),
  };
}

function buildStatistics(works: Work[]) {
  const total = works.length;
  const rated = works.filter((work) => work.calculatedRating !== null);
  const verified = works.filter((work) => work.curation?.status === "verified").length;
  const completed = works.filter((work) => work.status === "completed").length;
  const tracked = works.filter((work) => work.trackedOn !== null).length;
  const favorites = works.filter((work) => work.favorite).length;
  const averageRating = rated.length
    ? rated.reduce((sum, work) => sum + (work.calculatedRating ?? 0), 0) / rated.length
    : 0;

  const kinds = workKinds
    .map((kind) => {
      const count = works.filter((work) => work.kind === kind).length;
      return {
        label: kindLabels[kind],
        count,
        percentage: percentage(count, total),
      };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count);

  const trackingStatuses = personalStatuses
    .map((status) => {
      const count = works.filter((work) => work.status === status).length;
      return {
        label: statusLabelsAr[status],
        count,
        percentage: percentage(count, total),
      };
    })
    .filter((item) => item.count > 0);

  const coverageGroups: CoverageGroup[] = [
    {
      id: "identity",
      title: "الهوية والإصدار",
      description: "البيانات الأساسية للتعريف بالعمل وترتيبه زمنياً.",
      items: [
        makeCoverageItem(works, "العنوان العربي", "عنوان العرض المترجم", (work) =>
          Boolean(work.arabicTitle),
        ),
        makeCoverageItem(
          works,
          "سنة الإصدار",
          "السنة الأساسية في الفهرس",
          (work) => work.year !== null,
        ),
        makeCoverageItem(works, "تواريخ الإصدار", "تاريخ بداية أو نهاية معروف", (work) =>
          Boolean(work.releaseStart || work.releaseEnd),
        ),
        makeCoverageItem(
          works,
          "الملخص",
          "ملخص غير فارغ",
          (work) => work.summary.trim().length > 0,
        ),
        makeCoverageItem(
          works,
          "العناوين البديلة",
          "عناوين بديلة أو مترجمة",
          (work) => work.aliases.length > 0,
        ),
        makeCoverageItem(
          works,
          "الدولة",
          "دولة أو منطقة المنشأ",
          (work) => work.country.length > 0,
        ),
      ],
    },
    {
      id: "discovery",
      title: "بيانات الاكتشاف",
      description: "حقول البحث والفلترة والتوصيات والتنقل في الفهرس.",
      items: [
        makeCoverageItem(
          works,
          "التصنيفات",
          "تصنيفات عامة مضبوطة",
          (work) => work.genres.length > 0,
        ),
        makeCoverageItem(works, "الوسوم", "موضوعات وسمات محددة", (work) => work.tags.length > 0),
        makeCoverageItem(works, "الطابع", "المزاج وتجربة المشاهدة", (work) => work.tone.length > 0),
        makeCoverageItem(
          works,
          "الجمهور",
          "تصنيف الجمهور المستهدف",
          (work) => work.audience !== null,
        ),
        makeCoverageItem(
          works,
          "صنّاع العمل",
          "أشخاص ومؤسسات مسجلة",
          (work) => work.contributors.length > 0,
        ),
        makeCoverageItem(
          works,
          "العلاقات",
          "الاقتباسات والتكملات والأعمال المرتبطة",
          (work) => work.relations.length > 0,
        ),
      ],
    },
    {
      id: "structure",
      title: "البنية والمصدر",
      description: "الأطوال والمصادر والروابط والصور وحالة المراجعة.",
      items: [
        makeCoverageItem(
          works,
          "الطول المعروف",
          "المدة أو الصفحات أو الحلقات أو الفصول أو المجلدات أو المسارات",
          (work) =>
            work.runtimeMinutes !== null ||
            work.playtimeMinutes !== null ||
            work.pageCount !== null ||
            work.episodeCount !== null ||
            work.chapterCount !== null ||
            work.volumeCount !== null ||
            work.routeCount !== null,
        ),
        makeCoverageItem(
          works,
          "النشر",
          "صيغة النشر أو بيانات الناشر",
          (work) => work.publication !== null,
        ),
        makeCoverageItem(
          works,
          "المادة الأصلية",
          "المصدر الأصلي وبيانات التسلسل",
          (work) => work.sourceMaterial !== null,
        ),
        makeCoverageItem(
          works,
          "الروابط الخارجية",
          "مراجع موثّقة",
          (work) => work.externalLinks.length > 0,
        ),
        makeCoverageItem(works, "الصور", "ملصق أو غلاف أو شعار", (work) =>
          Boolean(work.imagePath || work.bannerPath || work.logoPath),
        ),
        makeCoverageItem(
          works,
          "مراجعة موثّقة",
          "سجل راجعه شخص",
          (work) => work.curation?.status === "verified",
        ),
      ],
    },
    {
      id: "personal",
      title: "السياق الشخصي",
      description: "التتبع والتقييم والملاحظات وتغطية تقييم المحتوى.",
      items: [
        makeCoverageItem(
          works,
          "سجل التتبع",
          "تاريخ تتبع واحد على الأقل",
          (work) => work.trackedOn !== null,
        ),
        makeCoverageItem(
          works,
          "التقييم",
          "التقييم الشخصي المحسوب",
          (work) => work.calculatedRating !== null,
        ),
        makeCoverageItem(
          works,
          "تفاصيل التقييم",
          "معيار تقييم واحد على الأقل",
          (work) => Object.keys(work.scoreComponents).length > 0,
        ),
        makeCoverageItem(works, "ملاحظات التحليل", "انطباع أو مراجعة خاصة", (work) =>
          Boolean(work.analysisNotes),
        ),
        makeCoverageItem(works, "تحذيرات المحتوى", "ملاحظات تحذيرية حرة", (work) =>
          Boolean(work.contentWarnings),
        ),
        makeCoverageItem(
          works,
          "ملف المخاطر",
          "تقييم المحتوى الجنسي والسلوكي والديني",
          (work) => work.riskProfile !== null,
        ),
      ],
    },
  ];

  return {
    overview: {
      entries: total,
      verified,
      verifiedPercentage: percentage(verified, total),
      completed,
      completionPercentage: percentage(completed, total),
      tracked,
      trackedPercentage: percentage(tracked, total),
      favorites,
      favoritePercentage: percentage(favorites, total),
      rated: rated.length,
      ratedPercentage: percentage(rated.length, total),
      averageRating: Number(averageRating.toFixed(2)),
    },
    composition: {
      kinds,
      trackingStatuses,
      releaseStatuses: distribution(works.map((work) => work.releaseStatus)),
      decades: distribution(
        works.map((work) =>
          work.year === null ? "غير معروف" : `عقد ${Math.floor(work.year / 10) * 10}`,
        ),
      ).sort((left, right) => left.label.localeCompare(right.label)),
      audiences: distribution(works.map((work) => work.audience)),
      countries: taxonomyDistribution(works, (work) => work.country),
      publicationFormats: distribution(works.map((work) => work.publication?.format)),
      sourceTypes: distribution(works.map((work) => work.sourceMaterial?.type)),
    },
    taxonomy: {
      tags: taxonomyDistribution(works, (work) => work.tags),
      genres: taxonomyDistribution(works, (work) => work.genres),
      tones: taxonomyDistribution(works, (work) => work.tone),
    },
    contributors: {
      roles: taxonomyDistribution(works, (work) =>
        work.contributors.map((contributor) => contributor.role),
      ),
      entityTypes: taxonomyDistribution(works, (work) =>
        work.contributors.map((contributor) => contributor.entityType),
      ),
    },
    risk: {
      sexuality: distribution(works.map((work) => work.riskProfile?.sexuality ?? "not assessed")),
      behavioral: distribution(works.map((work) => work.riskProfile?.behavioral ?? "not assessed")),
      theology: distribution(works.map((work) => work.riskProfile?.theology ?? "not assessed")),
    },
    coverageGroups,
    totals: {
      aliases: works.reduce((sum, work) => sum + work.aliases.length, 0),
      contributors: works.reduce((sum, work) => sum + work.contributors.length, 0),
      externalLinks: works.reduce((sum, work) => sum + work.externalLinks.length, 0),
      relations: new Set(works.flatMap((work) => work.relations.map(({ id }) => id))).size,
      episodes: works.reduce((sum, work) => sum + (work.episodeCount ?? 0), 0),
      chapters: works.reduce((sum, work) => sum + (work.chapterCount ?? 0), 0),
      pages: works.reduce((sum, work) => sum + (work.pageCount ?? 0), 0),
      runtimeMinutes: works.reduce((sum, work) => sum + (work.runtimeMinutes ?? 0), 0),
      playtimeMinutes: works.reduce((sum, work) => sum + (work.playtimeMinutes ?? 0), 0),
    },
  };
}

function formatItems(items: CountItem[]) {
  if (!items.length) return "- No values recorded.";
  return items
    .map(
      (item) =>
        `- ${item.label}: ${item.count} records (${item.percentage}% of the filtered library)`,
    )
    .join("\n");
}

function distributionPrompt({
  title,
  description,
  total,
  items,
}: {
  title: string;
  description: string;
  total: number;
  items: CountItem[];
}) {
  return `Analyze these aggregate statistics from my Arcadia media library. The current filtered view contains ${total} records. No individual titles or private record data are included.\n\nSTATISTICAL LENS: ${title}\n${description}\n\nDATA\n${formatItems(items)}\n\nTASK\nExplain the strongest patterns, imbalances, and gaps in plain language. Suggest practical catalog-cleanup, discovery, or recommendation ideas that follow only from these aggregates. State uncertainty clearly and do not invent information about individual works.`;
}

function coveragePrompt(group: CoverageGroup, total: number) {
  const fields = group.items
    .map(
      (item) =>
        `- ${item.label}: ${item.count}/${total} records (${item.percentage}%) — ${item.description}`,
    )
    .join("\n");

  return `Analyze the completeness of one field group in my Arcadia media library. This is aggregate coverage for ${total} filtered records; no individual records are included.\n\nFIELD GROUP: ${group.title}\n${group.description}\n\nCOVERAGE\n${fields}\n\nTASK\nPrioritize the missing metadata by usefulness and likely effort. Propose a safe, ordered cleanup plan. Explain which fields should remain unknown rather than guessed, and give concise validation rules I can use when improving this part of the database.`;
}

function overviewPrompt(statistics: ReturnType<typeof buildStatistics>) {
  const { overview } = statistics;
  return `Analyze this aggregate overview of my Arcadia media library. The numbers reflect the current filters and contain no individual record data.\n\n- Records: ${overview.entries}\n- Verified: ${overview.verified} (${overview.verifiedPercentage}%)\n- Completed: ${overview.completed} (${overview.completionPercentage}%)\n- Tracked: ${overview.tracked} (${overview.trackedPercentage}%)\n- Favorites: ${overview.favorites} (${overview.favoritePercentage}%)\n- Rated: ${overview.rated} (${overview.ratedPercentage}%)\n- Average rating among rated records: ${overview.averageRating}/10\n\nTASK\nSummarize what this says about the maturity and use of the library. Identify the most useful next cataloging actions and any caveats created by incomplete coverage. Do not infer facts about individual works.`;
}

function totalsPrompt(totals: ReturnType<typeof buildStatistics>["totals"], total: number) {
  const lines = Object.entries(totals)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n");
  return `Analyze these normalized aggregate totals from ${total} filtered records in my Arcadia media library. They contain no titles, IDs, or free text.\n\nTOTALS\n${lines}\n\nTASK\nExplain what these totals reveal about catalog depth and media mix. Call out comparisons that are statistically meaningful, warn where different units should not be compared directly, and suggest useful derived metrics I could add to the statistics page.`;
}

export function Statistics({ works }: { works: Work[] }) {
  const [copiedPrompt, setCopiedPrompt] = useState<CopiedPrompt>(null);
  const statistics = useMemo(() => buildStatistics(works), [works]);
  const { facetValueLabel, taxonomyLabel } = useArabicTranslations();
  const relabel = (items: CountItem[], label: (value: string) => string) =>
    items.map((item) => ({ ...item, label: label(item.label) }));

  const copyPrompt = async (id: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(id);
      window.setTimeout(() => setCopiedPrompt(null), 1800);
    } catch {
      setCopiedPrompt(null);
    }
  };

  if (!works.length) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <DatabaseIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد إحصاءات لهذا العرض</EmptyTitle>
              <EmptyDescription>
                امسح الفلاتر الحالية أو عدّلها لعرض سجل واحد على الأقل.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const { overview } = statistics;
  const compositionCards = [
    {
      id: "release-status",
      title: "حالة الإصدار",
      description: "توزيع الأعمال المعلنة أو الجارية أو المكتملة.",
      items: relabel(statistics.composition.releaseStatuses, (value) =>
        facetValueLabel("releaseStatuses", value),
      ),
    },
    {
      id: "tracking-status",
      title: "حالة التتبع",
      description: "توزيع حالة التقدم الشخصي الحالية.",
      items: statistics.composition.trackingStatuses,
    },
    {
      id: "formats",
      title: "الأنواع",
      description: "أنواع الوسائط الموجودة في عرض المكتبة الحالي.",
      items: statistics.composition.kinds,
    },
    {
      id: "decades",
      title: "عقود الإصدار",
      description: "توزيع سنوات الإصدار المعروفة في الفهرس.",
      items: statistics.composition.decades,
    },
  ];

  const vocabularyCards = [
    {
      id: "genres",
      title: "التصنيفات",
      description: "تصنيفات عامة؛ قد يظهر العمل الواحد في أكثر من تصنيف.",
      items: relabel(statistics.taxonomy.genres, (value) => taxonomyLabel("genre", value)),
    },
    {
      id: "tags",
      title: "الوسوم",
      description: "الموضوعات والبيئات والسمات المرتبطة بالسجلات.",
      items: relabel(statistics.taxonomy.tags, (value) => taxonomyLabel("tag", value)),
    },
    {
      id: "tones",
      title: "الطابع",
      description: "تصنيفات المزاج والتجربة؛ قد يحمل السجل أكثر من طابع.",
      items: relabel(statistics.taxonomy.tones, (value) => taxonomyLabel("tone", value)),
    },
  ];

  const contextCards = [
    {
      id: "audiences",
      title: "الجمهور",
      description: "تصنيفات الجمهور المستهدف حيثما كانت معروفة.",
      items: relabel(statistics.composition.audiences, (value) => taxonomyLabel("audience", value)),
    },
    {
      id: "countries",
      title: "الدول",
      description: "دول أو مناطق المنشأ؛ يُحسب العمل المشترك في كل دولة.",
      items: relabel(statistics.composition.countries, (value) => taxonomyLabel("country", value)),
    },
    {
      id: "contributor-roles",
      title: "أدوار صنّاع العمل",
      description: "أدوار المساهمة المرتبطة بالأشخاص والمؤسسات.",
      items: relabel(statistics.contributors.roles, (value) =>
        facetValueLabel("creatorRoles", value),
      ),
    },
    {
      id: "publication-formats",
      title: "صيغ النشر",
      description: "صيغ النشر المنظمة المعروفة.",
      items: statistics.composition.publicationFormats,
    },
    {
      id: "source-types",
      title: "المادة الأصلية",
      description: "أنواع المصادر الأصلية المعروفة.",
      items: statistics.composition.sourceTypes,
    },
    {
      id: "entity-types",
      title: "كيانات صنّاع العمل",
      description: "أنواع الأشخاص والمؤسسات المسجلة.",
      items: statistics.contributors.entityTypes,
    },
  ];

  const riskCards = [
    {
      id: "sexuality-risk",
      title: "تقييم المحتوى الجنسي",
      description: "توزيع مستويات التقييم وغياب التقييم.",
      items: relabel(statistics.risk.sexuality, (value) =>
        facetValueLabel("sexualityRisks", value),
      ),
    },
    {
      id: "behavioral-risk",
      title: "تقييم المحتوى السلوكي",
      description: "مستويات تقييم المحتوى السلوكي والتغطية الناقصة.",
      items: relabel(statistics.risk.behavioral, (value) =>
        facetValueLabel("behavioralRisks", value),
      ),
    },
    {
      id: "theology-risk",
      title: "تقييم المحتوى الديني",
      description: "مستويات تقييم المحتوى الديني والتغطية الناقصة.",
      items: relabel(statistics.risk.theology, (value) => facetValueLabel("theologyRisks", value)),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 pb-10">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>إحصاءات مباشرة</Badge>
            <Badge variant="outline">الفلاتر الحالية</Badge>
          </div>
          <CardTitle className="text-3xl">ملخص المكتبة</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            عرض إحصائي خاص للسجلات الظاهرة حالياً. كل نص قابل للنسخ في هذه الصفحة لا يتضمن سوى أرقام
            بطاقته.
          </CardDescription>
          <CardAction>
            <CopyPromptButton
              id="overview"
              prompt={overviewPrompt(statistics)}
              copiedPrompt={copiedPrompt}
              onCopy={copyPrompt}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted-foreground">السجلات الظاهرة</p>
              <p className="text-5xl font-semibold tabular-nums">
                {overview.entries.toLocaleString()}
              </p>
            </div>
            <Progress
              value={overview.verifiedPercentage}
              aria-label={`${overview.verifiedPercentage}% موثّق`}
            />
            <p className="text-sm text-muted-foreground">
              {overview.verifiedPercentage}% موثّق بعد مراجعة الفهرس
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <OverviewMetric
              label="مكتمل"
              value={`${overview.completionPercentage}%`}
              detail={`${overview.completed} سجل`}
              icon={<CheckCircleIcon weight="duotone" />}
            />
            <OverviewMetric
              label="متابَع"
              value={`${overview.trackedPercentage}%`}
              detail={`${overview.tracked} له نشاط`}
              icon={<ChartBarIcon weight="duotone" />}
            />
            <OverviewMetric
              label="متوسط التقييم"
              value={overview.averageRating.toFixed(1)}
              detail={`${overview.rated} سجل مقيّم`}
              icon={<StarIcon weight="duotone" />}
            />
            <OverviewMetric
              label="المفضلة"
              value={overview.favorites.toLocaleString()}
              detail={`${overview.favoritePercentage}% من هذا العرض`}
              icon={<HeartIcon weight="duotone" />}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t">
          <p className="text-sm text-muted-foreground">
            تتحدث الإحصاءات تلقائياً عند تغير البحث أو الفلاتر.
          </p>
        </CardFooter>
      </Card>

      <PromptNotice />

      <StatSection
        title="تكوين الفهرس"
        description="الشكل الأساسي والتوزيع الزمني للمكتبة بعد الفلترة."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {compositionCards.map((card) => (
            <DistributionCard
              key={card.id}
              {...card}
              total={overview.entries}
              copiedPrompt={copiedPrompt}
              onCopy={copyPrompt}
            />
          ))}
        </div>
      </StatSection>

      <StatSection title="المفردات" description="التصنيفات والمفردات المستخدمة لتنظيم الفهرس.">
        <div className="grid gap-4 lg:grid-cols-3">
          {vocabularyCards.map((card) => (
            <DistributionCard
              key={card.id}
              {...card}
              total={overview.entries}
              limit={10}
              copiedPrompt={copiedPrompt}
              onCopy={copyPrompt}
            />
          ))}
        </div>
      </StatSection>

      <StatSection
        title="تغطية قاعدة البيانات"
        description="مرجع يوضح الحقول الموجودة والناقصة والغرض من كل مجموعة."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {statistics.coverageGroups.map((group) => (
            <CoverageCard
              key={group.id}
              group={group}
              total={overview.entries}
              copiedPrompt={copiedPrompt}
              onCopy={copyPrompt}
            />
          ))}
        </div>
      </StatSection>

      <StatSection
        title="سياق الفهرس"
        description="الأصول والمصادر وبيانات النشر وسجلات المساهمين."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contextCards.map((card) => (
            <DistributionCard
              key={card.id}
              {...card}
              total={overview.entries}
              limit={8}
              compact
              copiedPrompt={copiedPrompt}
              onCopy={copyPrompt}
            />
          ))}
        </div>
      </StatSection>

      <StatSection
        title="تغطية تقييم المحتوى"
        description="مستويات تقييم المحتوى، بما فيها السجلات التي لم تُقيّم."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {riskCards.map((card) => (
            <DistributionCard
              key={card.id}
              {...card}
              total={overview.entries}
              compact
              copiedPrompt={copiedPrompt}
              onCopy={copyPrompt}
            />
          ))}
        </div>
      </StatSection>

      <TotalsCard
        totals={statistics.totals}
        total={overview.entries}
        copiedPrompt={copiedPrompt}
        onCopy={copyPrompt}
      />
    </div>
  );
}

function PromptNotice() {
  return (
    <Alert>
      <DatabaseIcon />
      <AlertTitle>نسخ آمن للبيانات</AlertTitle>
      <AlertDescription>
        تتضمن النصوص المنسوخة الأعداد والنسب المجمعة ومعنى الحقل ومهمة التحليل فقط، ولا تتضمن عناوين
        أو معرّفات أو ملاحظات أو بيانات JSON كاملة.
      </AlertDescription>
    </Alert>
  );
}

function StatSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <CardAction>
          <Badge variant="secondary">{icon}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function CopyPromptButton({
  id,
  prompt,
  copiedPrompt,
  onCopy,
}: {
  id: string;
  prompt: string;
  copiedPrompt: CopiedPrompt;
  onCopy: (id: string, prompt: string) => Promise<void>;
}) {
  const copied = copiedPrompt === id;
  return (
    <Button variant="outline" size="sm" onClick={() => void onCopy(id, prompt)}>
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <ClipboardTextIcon data-icon="inline-start" />
      )}
      {copied ? "تم نسخ النص" : "نسخ نص التحليل"}
    </Button>
  );
}

function DistributionCard({
  id,
  title,
  description,
  items,
  total,
  limit = 7,
  compact = false,
  copiedPrompt,
  onCopy,
}: {
  id: string;
  title: string;
  description: string;
  items: CountItem[];
  total: number;
  limit?: number;
  compact?: boolean;
  copiedPrompt: CopiedPrompt;
  onCopy: (id: string, prompt: string) => Promise<void>;
}) {
  const visibleItems = items.slice(0, limit);
  const prompt = distributionPrompt({ title, description, total, items });

  return (
    <Card size={compact ? "sm" : "default"}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <CopyPromptButton id={id} prompt={prompt} copiedPrompt={copiedPrompt} onCopy={onCopy} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm capitalize">{item.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.count} · {item.percentage}%
                </span>
              </div>
              <Progress
                value={item.percentage}
                aria-label={`${item.label}: ${item.count} records, ${item.percentage}%`}
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">لا توجد قيم مسجلة.</p>
        )}
      </CardContent>
      <CardFooter className="border-t">
        <p className="text-xs text-muted-foreground">
          {items.length > limit
            ? `عرض ${limit} من ${items.length}. يتضمن النص المنسوخ جميع القيم.`
            : `${items.length} قيمة ضمن ${total} سجل.`}
        </p>
      </CardFooter>
    </Card>
  );
}

function CoverageCard({
  group,
  total,
  copiedPrompt,
  onCopy,
}: {
  group: CoverageGroup;
  total: number;
  copiedPrompt: CopiedPrompt;
  onCopy: (id: string, prompt: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.title}</CardTitle>
        <CardDescription>{group.description}</CardDescription>
        <CardAction>
          <CopyPromptButton
            id={`coverage-${group.id}`}
            prompt={coveragePrompt(group, total)}
            copiedPrompt={copiedPrompt}
            onCopy={onCopy}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الحقل</TableHead>
              <TableHead className="text-right">المعبأ</TableHead>
              <TableHead className="text-right">التغطية</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.map((item) => (
              <TableRow key={item.label}>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.count}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {item.percentage}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="border-t">
        <p className="text-xs text-muted-foreground">
          تقيس التغطية وجود البيانات فقط، ولا تعني بالضرورة دقتها.
        </p>
      </CardFooter>
    </Card>
  );
}

function TotalsCard({
  totals,
  total,
  copiedPrompt,
  onCopy,
}: {
  totals: ReturnType<typeof buildStatistics>["totals"];
  total: number;
  copiedPrompt: CopiedPrompt;
  onCopy: (id: string, prompt: string) => Promise<void>;
}) {
  const labels: Record<keyof typeof totals, string> = {
    aliases: "العناوين البديلة",
    contributors: "صنّاع العمل",
    externalLinks: "الروابط الخارجية",
    relations: "علاقات الأعمال",
    episodes: "الحلقات المعروفة",
    chapters: "الفصول المعروفة",
    pages: "الصفحات المعروفة",
    runtimeMinutes: "دقائق مدة العرض",
    playtimeMinutes: "دقائق اللعب",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>الإجماليات المنظمة</CardTitle>
        <CardDescription>مجموع القيم المنظمة في السجلات المفلترة حالياً.</CardDescription>
        <CardAction>
          <CopyPromptButton
            id="normalized-totals"
            prompt={totalsPrompt(totals, total)}
            copiedPrompt={copiedPrompt}
            onCopy={onCopy}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(totals).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {labels[key as keyof typeof totals]}
            </span>
            <Badge variant="secondary">{value.toLocaleString()}</Badge>
          </div>
        ))}
      </CardContent>
      <CardFooter className="border-t">
        <p className="text-xs text-muted-foreground">
          تُحسب القياسات الفارغة صفراً؛ قارن وحدات الوسائط المختلفة بحذر.
        </p>
      </CardFooter>
    </Card>
  );
}
