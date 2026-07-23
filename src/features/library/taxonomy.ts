const canonicalGenre = new Map<string, string>([
  ["action", "Action"],
  ["adventure", "Adventure"],
  ["comedy", "Comedy"],
  ["drama", "Drama"],
  ["fantasy", "Fantasy"],
  ["historica", "Historical"],
  ["historical", "Historical"],
  ["horror", "Horror"],
  ["mecha", "Mecha"],
  ["military", "Military"],
  ["mystery", "Mystery"],
  ["music", "Music"],
  ["political", "Political"],
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
  ["action", ["Hype / Energetic"]],
  ["action-comedy", ["Hype / Energetic"]],
  ["action-heavy", ["Hype / Energetic"]],
  ["adventure", ["Hype / Energetic"]],
  ["adventurous", ["Hype / Energetic"]],
  ["aspirational", ["Wholesome"]],
  ["atmospheric", ["Atmospheric"]],
  ["bittersweet", ["Bittersweet"]],
  ["colorful", ["Surreal / Whimsical"]],
  ["creature-fantasy", ["Surreal / Whimsical", "Atmospheric"]],
  ["dark", ["Dark"]],
  ["disaster", ["Tense"]],
  ["emotional", ["Emotional"]],
  ["epic", ["Epic"]],
  ["family", ["Wholesome"]],
  ["family-comedy", ["Wholesome"]],
  ["fast-paced", ["Hype / Energetic"]],
  ["friendly", ["Wholesome"]],
  ["heartfelt", ["Emotional", "Wholesome"]],
  ["historical", ["Atmospheric"]],
  ["holiday-fantasy", ["Surreal / Whimsical"]],
  ["intense", ["Hype / Energetic"]],
  ["investigative", ["Tense"]],
  ["light", ["Wholesome"]],
  ["lighthearted", ["Wholesome"]],
  ["loud", ["Hype / Energetic"]],
  ["melancholic", ["Bittersweet"]],
  ["monster-fantasy", ["Dark", "Hype / Energetic"]],
  ["musical", ["Hype / Energetic"]],
  ["playful", ["Surreal / Whimsical"]],
  ["power-fantasy", ["Hype / Energetic"]],
  ["reflective", ["Reflective"]],
  ["social", ["Reflective"]],
  ["spiritual-fantasy", ["Reflective", "Atmospheric"]],
  ["sports", ["Hype / Energetic"]],
  ["stylized", ["Surreal / Whimsical"]],
  ["tense", ["Tense"]],
  ["tech-action", ["Hype / Energetic"]],
  ["tech-adventure", ["Hype / Energetic"]],
  ["whimsical", ["Surreal / Whimsical"]],
  ["wholesome", ["Wholesome"]],
])

const tagToTone = new Map<string, string[]>([
  ["atmospheric", ["Atmospheric"]],
  ["beautiful-animation", ["Surreal / Whimsical"]],
  ["beautiful-backgrounds", ["Atmospheric"]],
  ["emotional-drama", ["Emotional"]],
  ["family-friendly", ["Wholesome"]],
  ["high-stakes", ["Tense"]],
  ["low-action", ["Wholesome"]],
  ["low-drama", ["Wholesome"]],
  ["low-stakes", ["Wholesome"]],
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
      return []
    })
  )

  return {
    genres: unique(genres),
    tags: unique(tags),
    tone,
  }
}

export const canonicalGenres = [...new Set(canonicalGenre.values())]
