import { recordTrackingEntry } from "../src/db/repository";

type Status = "in-progress" | "completed" | "paused";

type Import = {
  title: string;
  workId: string;
  start: string;
  end: string;
  episodes: number;
  finalStatus: Status;
  exactDailyEpisodes?: number[];
};

// Public AniList record for user AshAmber, retrieved 2026-07-27.
// AniList supplies range endpoints and cumulative episode counts, not a
// per-episode diary. The generated days below are deterministic, varied, and
// bounded at four episodes a day. Violet Evergarden is retained exactly as
// supplied by the user: one episode on each of two consecutive days.
const imports: Import[] = [
  {
    title: "Attack on Titan",
    workId: "obsidian-animation-tv-attack-on-titan",
    start: "2026-03-20",
    end: "2026-04-28",
    episodes: 87,
    // Arcadia currently models 94 episodes across this work, while AniList
    // records 87 watched episodes through Final Season Part 2.
    finalStatus: "in-progress",
  },
  {
    title: "Oshi No Ko",
    workId: "obsidian-animation-tv-oshi-no-ko",
    start: "2026-04-02",
    end: "2026-05-10",
    episodes: 35,
    finalStatus: "completed",
  },
  {
    title: "Witch Hat Atelier",
    workId: "obsidian-animation-tv-witch-hat-atelier",
    start: "2026-04-07",
    end: "2026-06-23",
    episodes: 13,
    finalStatus: "completed",
  },
  {
    title: "Black Clover",
    workId: "obsidian-animation-tv-black-clover",
    start: "2025-06-13",
    end: "2025-09-05",
    episodes: 170,
    finalStatus: "completed",
  },
  {
    title: "Vinland Saga",
    workId: "obsidian-animation-tv-vinland-saga",
    start: "2026-06-01",
    end: "2026-07-26",
    episodes: 21,
    finalStatus: "in-progress",
  },
  {
    title: "Hunter × Hunter",
    workId: "obsidian-animation-tv-hunter-hunter-2011",
    start: "2026-05-24",
    end: "2026-06-08",
    episodes: 7,
    finalStatus: "paused",
  },
  {
    title: "Violet Evergarden",
    workId: "obsidian-animation-tv-violet-evergarden",
    start: "2026-06-07",
    end: "2026-06-08",
    episodes: 2,
    finalStatus: "in-progress",
    exactDailyEpisodes: [1, 1],
  },
  {
    title: "Frieren: Beyond Journey's End",
    workId: "obsidian-animation-tv-frieren-beyond-journeys-end",
    start: "2026-05-26",
    end: "2026-06-21",
    episodes: 28,
    // Arcadia includes later seasons in this single work, so 28 episodes is
    // correctly represented as progress rather than work-level completion.
    finalStatus: "in-progress",
  },
];

const dayMs = 24 * 60 * 60 * 1000;

function toDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, amount: number) {
  return formatDate(new Date(toDate(day).valueOf() + amount * dayMs));
}

function dayDistance(start: string, end: string) {
  return Math.round((toDate(end).valueOf() - toDate(start).valueOf()) / dayMs);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function seedFor(value: string) {
  return [...value].reduce((seed, character) => seed + character.charCodeAt(0), 0);
}

function generatedDailyEpisodes(entry: Import) {
  if (entry.exactDailyEpisodes) return entry.exactDailyEpisodes;
  const activeDays = Math.min(
    dayDistance(entry.start, entry.end) + 1,
    Math.max(2, Math.ceil(entry.episodes / 3)),
  );
  const random = seededRandom(seedFor(entry.workId));
  const episodes = Array.from({ length: activeDays }, () => 1);
  let remaining = entry.episodes - activeDays;
  while (remaining > 0) {
    const index = Math.floor(random() * activeDays);
    if (episodes[index] < 4) {
      episodes[index] += 1;
      remaining -= 1;
    }
  }
  return episodes;
}

function generatedDates(entry: Import, activeDays: number) {
  if (entry.exactDailyEpisodes) {
    return entry.exactDailyEpisodes.map((_, index) => addDays(entry.start, index));
  }
  const span = dayDistance(entry.start, entry.end);
  const random = seededRandom(seedFor(`${entry.workId}:dates`));
  const offsets = Array.from({ length: activeDays }, (_, index) => {
    if (index === 0) return 0;
    if (index === activeDays - 1) return span;
    const ideal = (index * span) / (activeDays - 1);
    return Math.round(ideal + (random() - 0.5) * 1.8);
  });
  for (let index = 1; index < offsets.length; index += 1) {
    offsets[index] = Math.max(offsets[index], offsets[index - 1] + 1);
  }
  for (let index = offsets.length - 2; index > 0; index -= 1) {
    offsets[index] = Math.min(offsets[index], offsets[index + 1] - 1);
  }
  return offsets.map((offset) => addDays(entry.start, offset));
}

for (const entry of imports) {
  const dailyEpisodes = generatedDailyEpisodes(entry);
  const dates = generatedDates(entry, dailyEpisodes.length);
  if (dailyEpisodes.reduce((sum, amount) => sum + amount, 0) !== entry.episodes) {
    throw new Error(`${entry.title}: generated episode total is incorrect.`);
  }
  if (dates.at(-1) !== entry.end) {
    throw new Error(`${entry.title}: generated date range is incorrect.`);
  }

  let progress = 0;
  for (const [index, episodes] of dailyEpisodes.entries()) {
    progress += episodes;
    recordTrackingEntry({
      workId: entry.workId,
      progress,
      status: index === dailyEpisodes.length - 1 ? entry.finalStatus : "in-progress",
      occurredOn: dates[index],
    });
  }
  console.log(`${entry.title}: ${dailyEpisodes.length} log days, ${progress} episodes`);
}
