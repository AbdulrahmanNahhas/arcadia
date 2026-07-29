import {
  BooksIcon,
  FilmSlateIcon,
  GameControllerIcon,
  SparkleIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import type { Work, WorkKind } from "./model"

export const collectionIds = [
  "all",
  "books-comics",
  "western-cartoons",
  "eastern-cartoons",
  "games",
] as const

export type CollectionId = (typeof collectionIds)[number]

export type LibraryCollection = {
  id: CollectionId
  title: string
  shortTitle: string
  description: string
  eyebrow: string
  icon: Icon
  kinds: WorkKind[]
}

export const libraryCollections: LibraryCollection[] = [
  {
    id: "all",
    title: "كل ما في أركاديا",
    shortTitle: "كل الأعمال",
    description: "الفهرس الكامل لكل قصة شاهدتها أو قرأتها أو لعبتها.",
    eyebrow: "الفهرس الرئيسي",
    icon: SquaresFourIcon,
    kinds: [],
  },
  {
    id: "books-comics",
    title: "الروايات والقصص المصورة",
    shortTitle: "الروايات والقصص",
    description:
      "كل ما يُقرأ: الكتب والروايات والكوميكس والمانغا والروايات المرئية.",
    eyebrow: "للقراءة",
    icon: BooksIcon,
    kinds: ["novel", "manga", "comic", "visual-novel"],
  },
  {
    id: "western-cartoons",
    title: "الرسوم المتحركة الغربية",
    shortTitle: "الرسوم المتحركة",
    description: "المسلسلات وأفلام الرسوم المتحركة الغربية في مجموعة واحدة.",
    eyebrow: "كرتون",
    icon: FilmSlateIcon,
    kinds: ["series", "movie"],
  },
  {
    id: "eastern-cartoons",
    title: "الرسوم المتحركة الشرقية",
    shortTitle: "الأنمي",
    description:
      "مسلسلات الأنمي وأفلام الأنمي، مع التقدم والتقييمات وقائمة المشاهدة.",
    eyebrow: "أنمي",
    icon: SparkleIcon,
    kinds: ["anime", "movie"],
  },
  {
    id: "games",
    title: "الألعاب",
    shortTitle: "الألعاب",
    description: "الألعاب التي أنهيتها أو تلعبها الآن أو تنتظر دورها.",
    eyebrow: "للعب",
    icon: GameControllerIcon,
    kinds: ["game"],
  },
]

export function isCollectionId(value: string): value is CollectionId {
  return collectionIds.includes(value as CollectionId)
}

export function getCollection(id: CollectionId) {
  return libraryCollections.find((collection) => collection.id === id)!
}

export function workBelongsToCollection(
  work: Work,
  collection: LibraryCollection
) {
  if (collection.id === "all") return true
  if (collection.id === "western-cartoons") {
    return (
      work.kind === "series" ||
      (work.kind === "movie" && work.tags.includes("Animated Movie"))
    )
  }
  if (collection.id === "eastern-cartoons") {
    return (
      work.kind === "anime" ||
      (work.kind === "movie" && work.tags.includes("Anime Movie"))
    )
  }
  return collection.kinds.includes(work.kind)
}
