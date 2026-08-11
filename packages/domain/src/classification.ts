import { z } from "zod";

export const audienceValues = ["general", "teen", "young-adult", "adult"] as const;
export const ageValues = ["all", "7+", "10+", "13+", "16+", "18+"] as const;
export const riskValues = ["none", "low", "medium", "high"] as const;
export const riskDimensions = ["sexuality", "behavioral", "theology"] as const;

export const audienceSchema = z.enum(audienceValues);
export const ageSchema = z.enum(ageValues);
export const riskLevelSchema = z.enum(riskValues);
export type Audience = z.infer<typeof audienceSchema>;
export type Age = z.infer<typeof ageSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export type Classification = {
  audience: Audience;
  age: Age;
  sexuality: RiskLevel;
  behavioral: RiskLevel;
  theology: RiskLevel;
};

export type ClassificationOverrides = Partial<{
  [K in keyof Classification]: Classification[K] | null;
}>;

export function effectiveClassification(
  title: Classification,
  installment: ClassificationOverrides,
): Classification {
  return Object.fromEntries(
    Object.entries(title).map(([key, value]) => [
      key,
      installment[key as keyof Classification] ?? value,
    ]),
  ) as Classification;
}

const rank = <T extends string>(values: readonly T[], value: T) => values.indexOf(value);

export function isClassificationAllowed(value: Classification, maximum: Classification) {
  return (
    rank(audienceValues, value.audience) <= rank(audienceValues, maximum.audience) &&
    rank(ageValues, value.age) <= rank(ageValues, maximum.age) &&
    rank(riskValues, value.sexuality) <= rank(riskValues, maximum.sexuality) &&
    rank(riskValues, value.behavioral) <= rank(riskValues, maximum.behavioral) &&
    rank(riskValues, value.theology) <= rank(riskValues, maximum.theology)
  );
}

export function intersectClassifications(a: Classification, b: Classification): Classification {
  const stricter = <T extends string>(values: readonly T[], left: T, right: T) =>
    values[Math.min(rank(values, left), rank(values, right))] as T;
  return {
    audience: stricter(audienceValues, a.audience, b.audience),
    age: stricter(ageValues, a.age, b.age),
    sexuality: stricter(riskValues, a.sexuality, b.sexuality),
    behavioral: stricter(riskValues, a.behavioral, b.behavioral),
    theology: stricter(riskValues, a.theology, b.theology),
  };
}
