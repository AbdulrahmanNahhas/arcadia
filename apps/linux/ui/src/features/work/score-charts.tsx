import type { WorkDetail } from "@nahhasio/api-contract";
import { useId } from "react";

import { criteria } from "../catalog/filter-model";
import { scoreProfile, scoreValue } from "./score-model";

function radarPoint(index: number, value: number) {
  const angle = -Math.PI / 2 - (index * Math.PI) / 3;
  return { x: 180 + Math.cos(angle) * value * 11, y: 160 + Math.sin(angle) * value * 11 };
}

export function ScoreFingerprint({ profile }: { profile: ReturnType<typeof scoreProfile> }) {
  const title = useId();
  const description = useId();
  if (!profile.summary.scored) return null;
  const points = profile.criteria.flatMap((criterion, index) =>
    criterion.average === null ? [] : [radarPoint(index, criterion.average)],
  );
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <svg
        className="mx-auto w-full max-w-sm"
        viewBox="0 0 360 320"
        role="img"
        aria-labelledby={`${title} ${description}`}
      >
        <title id={title}>بصمة المعايير الستة</title>
        <desc id={description}>
          {profile.criteria
            .map((criterion) => `${criterion.label}: ${criterion.average?.toFixed(2)} من عشرة`)
            .join("، ")}
          . متوسط معايير الأجزاء المكتملة فقط؛ الحلقة الخارجية تساوي عشرة.
        </desc>
        {[2, 4, 6, 8, 10].map((level) => (
          <polygon
            key={level}
            points={criteria
              .map((_, index) => {
                const p = radarPoint(index, level);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            className="fill-none stroke-border"
          />
        ))}
        {profile.criteria.map((criterion, index) => {
          const end = radarPoint(index, 10);
          const label = radarPoint(index, 12);
          return (
            <g key={criterion.key}>
              <line x1={180} y1={160} x2={end.x} y2={end.y} className="stroke-border" />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                {criterion.key === "story"
                  ? "القصة"
                  : criterion.key === "craft"
                    ? "التنفيذ"
                    : criterion.label}
              </text>
            </g>
          );
        })}
        <polygon
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          className="fill-primary/15 stroke-primary"
          strokeWidth={2}
        />
        {points.map((point, index) => (
          <circle
            key={criteria[index].key}
            cx={point.x}
            cy={point.y}
            r={3}
            className="fill-primary"
          />
        ))}
      </svg>
      <figcaption className="text-center text-xs leading-relaxed text-muted-foreground">
        متوسط كل معيار من {profile.summary.scored} أجزاء مكتملة · المقياس من ٠ إلى ١٠
      </figcaption>
    </figure>
  );
}

export function CriterionTrend({
  work,
  criterion,
}: {
  work: WorkDetail;
  criterion: (typeof criteria)[number];
}) {
  const title = useId();
  const description = useId();
  const points = work.installments.map((unit, index) => {
    const value = scoreValue(unit.scores?.[criterion.key]);
    return {
      id: unit.id,
      name: unit.title,
      value,
      x:
        work.installments.length === 1 ? 160 : 292 - (index * 256) / (work.installments.length - 1),
      y: value === null ? null : 136 - value * 11.2,
    };
  });
  if (!points.some((point) => point.value !== null)) return null;
  const path = points
    .map((point, index) =>
      point.y === null
        ? ""
        : `${index === 0 || points[index - 1].y === null ? "M" : "L"}${point.x},${point.y}`,
    )
    .join(" ");
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{criterion.label}</h3>
        <span className="text-xs text-muted-foreground">
          {points.filter((point) => point.value !== null).length}/{points.length} أجزاء
        </span>
      </figcaption>
      <svg
        viewBox="0 0 320 168"
        className="w-full"
        role="img"
        aria-labelledby={`${title} ${description}`}
      >
        <title id={title}>{criterion.label} عبر الأجزاء</title>
        <desc id={description}>
          {points
            .map(
              (point) =>
                `${point.name}: ${point.value === null ? "غير مقيّم" : `${point.value} من عشرة`}`,
            )
            .join("، ")}
          . ترتيب الأجزاء من اليمين إلى اليسار. الفجوات تعني أن التقييم غير مكتمل.
        </desc>
        {[0, 5, 10].map((level) => (
          <g key={level}>
            <line
              x1={28}
              x2={300}
              y1={136 - level * 11.2}
              y2={136 - level * 11.2}
              className="stroke-border"
            />
            <text
              x={12}
              y={140 - level * 11.2}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              {level}
            </text>
          </g>
        ))}
        <path
          d={path}
          className="fill-none stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <g key={point.id}>
            {point.y !== null && (
              <circle cx={point.x} cy={point.y} r={3} className="fill-primary">
                <title>
                  {point.name}: {point.value}
                </title>
              </circle>
            )}
            {(points.length <= 8 || index === 0 || index === points.length - 1) && (
              <text
                x={point.x}
                y={158}
                textAnchor="middle"
                className="fill-muted-foreground text-xs"
              >
                {index + 1}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
