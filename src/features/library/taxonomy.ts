const canonicalGenre = new Map<string, string>([
  ["action", "Action"],
  ["adventure", "Adventure"],
  ["comedy", "Comedy"],
  ["crime", "Crime"],
  ["drama", "Drama"],
  ["fantasy", "Fantasy"],
  ["historica", "Historical"],
  ["historical", "Historical"],
  ["horror", "Horror"],
  ["mecha", "Mecha"],
  ["mystery", "Mystery"],
  ["music", "Music"],
  ["psychological", "Psychological"],
  ["romance", "Romance"],
  ["sci-fi", "Science Fiction"],
  ["science fiction", "Science Fiction"],
  ["slice of life", "Slice of Life"],
  ["sports", "Sports"],
  ["supernatural", "Supernatural"],
  ["thriller", "Thriller"],
  ["war", "War"],
]);

const genreToTag = new Map<string, { tag: string; ensureGenres?: string[] }>([
  ["allegory", { tag: "allegory", ensureGenres: ["Drama"] }],
  ["classics", { tag: "childhood-classic", ensureGenres: ["Drama"] }],
  ["coming-of-age", { tag: "coming-of-age", ensureGenres: ["Drama"] }],
  ["dark fantasy", { tag: "dark-fantasy", ensureGenres: ["Fantasy"] }],
  ["epic fantasy", { tag: "epic-fantasy", ensureGenres: ["Fantasy"] }],
  ["food", { tag: "cooking" }],
  ["high fantasy", { tag: "epic-fantasy", ensureGenres: ["Fantasy"] }],
  ["martial arts", { tag: "martial-arts", ensureGenres: ["Action"] }],
  ["military", { tag: "military" }],
  ["political", { tag: "political", ensureGenres: ["Drama"] }],
  ["political satire", { tag: "political-satire", ensureGenres: ["Drama"] }],
  ["superhero", { tag: "special-abilities", ensureGenres: ["Action"] }],
]);

const removedGuidanceTags = new Set([
  "behavioralrisk",
  "high-behavioralrisk",
  "low-behavioralrisk",
  "low-fanservice",
  "theology-risk",
  "low-theology-risk",
]);

const redundantGenreTags = new Set([
  "action",
  "adventure",
  "comedy",
  "crime",
  "drama",
  "fantasy",
  "historical",
  "mecha",
  "mystery",
  "music",
  "psychological",
  "romance",
  "sci-fi",
  "slice-of-life",
  "sports",
  "supernatural",
  "thriller",
  "war",
]);

const tagAliases = new Map([
  ["ai", "artificial-intelligence"],
  ["badminton", "badminton"],
  ["basketball", "basketball"],
  ["classic", "childhood-classic"],
  ["creatures", "monsters"],
  ["curse", "curses"],
  ["dungeon", "dungeons"],
  ["found-family", "found-family"],
  ["food", "cooking"],
  ["gender-roles", "gender-roles"],
  ["identity", "identity"],
  ["journey", "travel"],
  ["life-choices", "life-choices"],
  ["magic", "magic"],
  ["magic-system", "magic"],
  ["power", "special-abilities"],
  ["power-progression", "training"],
  ["school-life", "school"],
  ["slow-burn", "slow-burn"],
  ["super-hero", "special-abilities"],
]);

const toneAliases = new Map<string, string[]>([
  ["action", ["Energetic"]],
  ["action-comedy", ["Energetic"]],
  ["action-heavy", ["Energetic"]],
  ["adventure", ["Energetic"]],
  ["adventurous", ["Energetic"]],
  ["aspirational", ["Wholesome"]],
  ["atmospheric", ["Atmospheric"]],
  ["bittersweet", ["Bittersweet"]],
  ["colorful", ["Whimsical"]],
  ["creature-fantasy", ["Whimsical", "Atmospheric"]],
  ["dark", ["Dark"]],
  ["disaster", ["Tense"]],
  ["emotional", ["Emotional"]],
  ["epic", ["Epic"]],
  ["family", ["Wholesome"]],
  ["family-comedy", ["Wholesome"]],
  ["fast-paced", ["Energetic"]],
  ["friendly", ["Wholesome"]],
  ["heartfelt", ["Emotional", "Wholesome"]],
  ["historical", ["Atmospheric"]],
  ["holiday-fantasy", ["Whimsical"]],
  ["intense", ["Energetic"]],
  ["investigative", ["Tense"]],
  ["light", ["Wholesome"]],
  ["lighthearted", ["Wholesome"]],
  ["loud", ["Energetic"]],
  ["melancholic", ["Bittersweet"]],
  ["monster-fantasy", ["Dark", "Energetic"]],
  ["musical", ["Energetic"]],
  ["playful", ["Whimsical"]],
  ["power-fantasy", ["Energetic"]],
  ["reflective", ["Reflective"]],
  ["social", ["Reflective"]],
  ["spiritual-fantasy", ["Reflective", "Atmospheric"]],
  ["sports", ["Energetic"]],
  ["stylized", ["Whimsical"]],
  ["tense", ["Tense"]],
  ["tech-action", ["Energetic"]],
  ["tech-adventure", ["Energetic"]],
  ["whimsical", ["Whimsical"]],
  ["wholesome", ["Wholesome"]],
]);

const tagToTone = new Map<string, string[]>([
  ["atmospheric", ["Atmospheric"]],
  ["beautiful-animation", ["Whimsical"]],
  ["beautiful-backgrounds", ["Atmospheric"]],
  ["emotional-drama", ["Emotional"]],
  ["family-friendly", ["Wholesome"]],
  ["high-stakes", ["Tense"]],
  ["low-action", ["Wholesome"]],
  ["low-drama", ["Wholesome"]],
  ["low-stakes", ["Wholesome"]],
  ["wholesome", ["Wholesome"]],
]);

function slug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeTaxonomy(input: { genres: string[]; tags: string[]; tone: string[] }) {
  const genres: string[] = [];
  const promotedTags: string[] = [];
  for (const value of input.genres) {
    const key = value.trim().toLocaleLowerCase();
    const canonical = canonicalGenre.get(key);
    if (canonical) {
      genres.push(canonical);
      continue;
    }
    const promotion = genreToTag.get(key);
    if (!promotion) continue;
    promotedTags.push(promotion.tag);
    genres.push(...(promotion.ensureGenres ?? []));
  }

  const normalizedInputTags = unique([...input.tags, ...promotedTags].map(slug));
  const promotedTones = normalizedInputTags.flatMap((tag) => tagToTone.get(tag) ?? []);
  const tags = normalizedInputTags
    .map((tag) => tagAliases.get(tag) ?? tag)
    .filter(
      (tag) =>
        !removedGuidanceTags.has(tag) &&
        !redundantGenreTags.has(tag) &&
        !tagToTone.has(tag) &&
        tag !== "movie" &&
        tag !== "franchise-film",
    );

  const tone = unique(
    [...input.tone, ...promotedTones].flatMap((value) => {
      const alias = toneAliases.get(slug(value));
      if (alias) return alias;
      return [];
    }),
  );

  return {
    genres: unique(genres),
    tags: unique(tags),
    tone,
  };
}

export const canonicalGenres = [...new Set(canonicalGenre.values())];
