const canonicalGenre = new Map<string, string>([
  ["action", "Action"],
  ["adventure", "Adventure"],
  ["comedy", "Comedy"],
  ["drama", "Drama"],
  ["fantasy", "Fantasy"],
  ["historica", "Historical"],
  ["historical", "Historical"],
  ["horror", "Horror"],
  ["mystery", "Mystery"],
  ["music", "Music"],
  ["psychological", "Psychological"],
  ["romance", "Romance"],
  ["sci-fi", "Sci-Fi"],
  ["science fiction", "Sci-Fi"],
  ["slice of life", "Slice of Life"],
  ["sports", "Sports"],
  ["supernatural", "Supernatural"],
  ["thriller", "Thriller"],
])

const genreToTag = new Map<string, { tag: string; ensureGenres?: string[] }>([
  ["allegory", { tag: "allegory", ensureGenres: ["Drama"] }],
  ["classics", { tag: "classic-literature", ensureGenres: ["Drama"] }],
  ["coming-of-age", { tag: "coming-of-age", ensureGenres: ["Drama"] }],
  ["dark fantasy", { tag: "dark-fantasy", ensureGenres: ["Fantasy"] }],
  ["epic fantasy", { tag: "epic-fantasy", ensureGenres: ["Fantasy"] }],
  ["food", { tag: "cooking" }],
  ["high fantasy", { tag: "high-fantasy", ensureGenres: ["Fantasy"] }],
  ["martial arts", { tag: "martial-arts", ensureGenres: ["Action"] }],
  ["mecha", { tag: "mecha", ensureGenres: ["Sci-Fi"] }],
  ["military", { tag: "military" }],
  ["political satire", { tag: "political-satire", ensureGenres: ["Drama"] }],
  ["superhero", { tag: "superhero", ensureGenres: ["Action"] }],
])

const removedGuidanceTags = new Set([
  "behavioralrisk",
  "high-behavioralrisk",
  "low-behavioralrisk",
  "low-fanservice",
  "theology-risk",
  "low-theology-risk",
])

const redundantGenreTags = new Set([
  "action",
  "adventure",
  "comedy",
  "drama",
  "fantasy",
  "historical",
  "mystery",
  "music",
  "psychological",
  "romance",
  "sci-fi",
  "slice-of-life",
  "sports",
  "supernatural",
  "thriller",
])

const tagAliases = new Map([
  ["ai", "artificial-intelligence"],
  ["badminton", "badminton"],
  ["basketball", "basketball"],
  ["classic", "classic-literature"],
  ["creatures", "monsters"],
  ["curse", "curses"],
  ["dungeon", "dungeons"],
  ["found-family", "found-family"],
  ["food", "cooking"],
  ["gender-roles", "gender-roles"],
  ["identity", "identity"],
  ["journey", "journey"],
  ["life-choices", "life-choices"],
  ["magic", "magic"],
  ["magic-system", "magic-system"],
  ["power", "power"],
  ["power-progression", "power-progression"],
  ["school-life", "school-life"],
  ["slow-burn", "slow-burn"],
  ["super-hero", "superhero"],
])

const toneAliases = new Map<string, string[]>([
  ["action", ["Energetic"]],
  ["action-comedy", ["Energetic", "Comedic"]],
  ["action-heavy", ["Intense", "Fast-paced"]],
  ["adventure", ["Adventurous"]],
  ["aspirational", ["Inspirational"]],
  ["campus", ["Youthful"]],
  ["colorful", ["Playful"]],
  ["comic", ["Comedic"]],
  ["creature-fantasy", ["Adventurous", "Atmospheric"]],
  ["disaster", ["Tense"]],
  ["family", ["Warm"]],
  ["family-comedy", ["Warm", "Comedic"]],
  ["friendly", ["Warm"]],
  ["heartfelt", ["Emotional", "Warm"]],
  ["historical", ["Atmospheric"]],
  ["holiday-fantasy", ["Playful"]],
  ["investigative", ["Mysterious"]],
  ["light", ["Lighthearted"]],
  ["loud", ["Energetic"]],
  ["mentorship", ["Hopeful"]],
  ["monster-fantasy", ["Dark", "Adventurous"]],
  ["musical", ["Energetic"]],
  ["pet-comedy", ["Comedic", "Playful"]],
  ["pop", ["Energetic"]],
  ["power-fantasy", ["Triumphant"]],
  ["road-adventure", ["Adventurous"]],
  ["seafaring", ["Adventurous"]],
  ["sequel", []],
  ["social", ["Reflective"]],
  ["spiritual-fantasy", ["Spiritual", "Atmospheric"]],
  ["sports", ["Energetic"]],
  ["spy-comedy", ["Witty", "Comedic"]],
  ["stylized", ["Stylish"]],
  ["team-comedy", ["Comedic"]],
  ["tech-action", ["Energetic", "Fast-paced"]],
  ["tech-adventure", ["Adventurous"]],
  ["underdog", ["Inspirational"]],
  ["urban", []],
  ["vacation", ["Lighthearted"]],
])

const tagToTone = new Map<string, string[]>([
  ["atmospheric", ["Atmospheric"]],
  ["beautiful-animation", ["Stylish"]],
  ["beautiful-backgrounds", ["Atmospheric"]],
  ["emotional-drama", ["Emotional", "Dramatic"]],
  ["family-friendly", ["Wholesome"]],
  ["high-stakes", ["Tense"]],
  ["low-action", ["Gentle"]],
  ["low-drama", ["Lighthearted"]],
  ["low-stakes", ["Gentle"]],
  ["wholesome", ["Wholesome"]],
])

function slug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function normalizeTaxonomy(input: {
  genres: string[]
  tags: string[]
  tone: string[]
}) {
  const genres: string[] = []
  const promotedTags: string[] = []
  for (const value of input.genres) {
    const key = value.trim().toLocaleLowerCase()
    const canonical = canonicalGenre.get(key)
    if (canonical) {
      genres.push(canonical)
      continue
    }
    const promotion = genreToTag.get(key)
    if (!promotion) continue
    promotedTags.push(promotion.tag)
    genres.push(...(promotion.ensureGenres ?? []))
  }

  const normalizedInputTags = unique([...input.tags, ...promotedTags].map(slug))
  const promotedTones = normalizedInputTags.flatMap(
    (tag) => tagToTone.get(tag) ?? []
  )
  const tags = normalizedInputTags
    .map((tag) => tagAliases.get(tag) ?? tag)
    .filter(
      (tag) =>
        !removedGuidanceTags.has(tag) &&
        !redundantGenreTags.has(tag) &&
        !tagToTone.has(tag) &&
        tag !== "movie" &&
        tag !== "franchise-film"
    )

  const tone = unique(
    [...input.tone, ...promotedTones].flatMap((value) => {
      const alias = toneAliases.get(slug(value))
      if (alias) return alias
      const normalized = value.trim()
      return normalized
        ? [normalized.charAt(0).toUpperCase() + normalized.slice(1)]
        : []
    })
  )

  return {
    genres: unique(genres),
    tags: unique(tags),
    tone,
  }
}

export const canonicalGenres = [...new Set(canonicalGenre.values())]
