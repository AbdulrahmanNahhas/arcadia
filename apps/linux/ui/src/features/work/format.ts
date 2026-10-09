import type { ArtworkAssignment } from "@nahhasio/api-contract";
export function dateLabel(date: string | null | undefined) {
  if (!date) return "غير معروف";
  const value = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
  return Number.isNaN(value.getTime())
    ? date
    : new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}
export function pickArtwork(images: ArtworkAssignment[], role: string) {
  return images.find((a) => a.role === role && a.isPrimary) ?? images.find((a) => a.role === role);
}
export const riskLabels = new Map([
  ["none", "لا يوجد"],
  ["low", "منخفض"],
  ["medium", "متوسط"],
  ["high", "مرتفع"],
]);
export const audienceLabels = new Map([
  ["general", "عام"],
  ["teen", "مراهقون"],
  ["young-adult", "شباب بالغون"],
  ["adult", "بالغون"],
]);
export const statusLabels = new Map([
  ["announced", "قادم"],
  ["airing", "يعرض الآن"],
  ["completed", "مكتمل"],
  ["unknown", "غير معروف"],
  ["released", "صدر"],
  ["upcoming", "قادم"],
]);
