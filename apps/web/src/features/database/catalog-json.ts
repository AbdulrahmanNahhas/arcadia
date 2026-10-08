import { z } from "zod";

import type { JsonValue } from "@/features/editor/document-model";

import { rowSchema, type DatabaseRow, type DatabaseTable } from "./database-model";

const integerTypes = new Set(["int2", "int4", "int8"]);
const numberTypes = new Set(["float4", "float8", "numeric", "money"]);
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function validateCatalogJson(
  next: JsonValue,
  columns: DatabaseTable["columns"],
  lockedNames: ReadonlySet<string>,
): DatabaseRow {
  const parsed = rowSchema.safeParse(next);
  if (!parsed.success)
    throw new Error("يجب أن يكون JSON كائناً يحتوي أسماء الحقول وقيمها، وليس قائمة أو قيمة منفردة.");
  for (const [key, value] of Object.entries(parsed.data)) {
    const column = columns.find((item) => item.name === key);
    if (!column || lockedNames.has(key))
      throw new Error(`${key}: حقل غير معروف أو محمي؛ لا يمكن إضافته أو تغييره هنا.`);
    if (value === null) {
      if (!column.nullable) throw new Error(`${key}: هذا الحقل لا يقبل null.`);
      continue;
    }
    if (column.enum_values.length) {
      const candidate = z.string().safeParse(value);
      if (!candidate.success || !column.enum_values.includes(candidate.data))
        throw new Error(`${key}: القيم المتاحة هي ${column.enum_values.join("، ")}.`);
      continue;
    }
    const type = column.data_type;
    if (type === "json" || type === "jsonb") continue;
    if (type.startsWith("_")) {
      if (!Array.isArray(value)) throw new Error(`${key}: يجب أن تكون القيمة قائمة JSON.`);
      continue;
    }
    if (type === "bool") {
      if (!z.boolean().safeParse(value).success)
        throw new Error(`${key}: استخدم true أو false بدون علامات اقتباس.`);
    } else if (integerTypes.has(type)) {
      const candidate = z.number().safeParse(value);
      if (!candidate.success || !Number.isSafeInteger(candidate.data))
        throw new Error(`${key}: يجب أن تكون القيمة رقماً صحيحاً آمناً بدون علامات اقتباس.`);
      const number = candidate.data;
      if (
        (type === "int2" && (number < -32768 || number > 32767)) ||
        (type === "int4" && (number < -2147483648 || number > 2147483647))
      )
        throw new Error(`${key}: الرقم خارج نطاق الحقل.`);
    } else if (numberTypes.has(type)) {
      const candidate = z.number().safeParse(value);
      if (!candidate.success || !Number.isFinite(candidate.data))
        throw new Error(`${key}: يجب أن تكون القيمة رقماً بدون علامات اقتباس.`);
    } else {
      const candidate = z.string().safeParse(value);
      if (!candidate.success) throw new Error(`${key}: يجب أن تكون القيمة نصاً بين علامتي اقتباس.`);
      if (type === "uuid" && !z.string().uuid().safeParse(candidate.data).success)
        throw new Error(`${key}: المعرّف UUID غير صالح. استخدم اختيار العلاقات في تبويب الحقول.`);
      if (type === "date" && !validDate(candidate.data))
        throw new Error(`${key}: استخدم تاريخاً صحيحاً بصيغة YYYY-MM-DD.`);
      if (
        ["timestamp", "timestamptz"].includes(type) &&
        !Number.isFinite(Date.parse(candidate.data))
      )
        throw new Error(`${key}: قيمة التاريخ والوقت غير صالحة.`);
    }
  }
  return parsed.data;
}
