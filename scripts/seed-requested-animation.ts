import { createWork, listWorks, updateWork } from "@/db/repository";
import type { AdminWorkUpdate, WorkKind } from "@/features/library/model";

type CatalogEntry = Omit<AdminWorkUpdate, "id">;

const noWatchDates = {
  firstWatchedAt: null,
  lastWatchedAt: null,
  completedAt: null,
};

function contributor(
  name: string,
  entityType: "person" | "organization",
  role: AdminWorkUpdate["contributors"][number]["role"],
  isPrimary = false,
) {
  return {
    entityId: `new:${entityType}:${name.toLocaleLowerCase()}`,
    name,
    entityType,
    role,
    isPrimary,
  };
}

function entry(input: {
  title: string;
  arabicTitle: string;
  kind: WorkKind;
  year: number;
  planetId: string;
  runtimeMinutes: number;
  episodeCount: number;
  summary: string;
  aliases: string[];
  genres: CatalogEntry["genres"];
  tags: string[];
  tone: CatalogEntry["tone"];
  audience: CatalogEntry["audience"];
  country: CatalogEntry["country"];
  contentWarnings: string;
  analysisNotes: string;
  riskProfile: NonNullable<CatalogEntry["riskProfile"]>;
  releaseStart: string;
  releaseEnd: string;
  sourceMaterial: CatalogEntry["sourceMaterial"];
  contributors: CatalogEntry["contributors"];
  externalLinks: CatalogEntry["externalLinks"];
}): CatalogEntry {
  return {
    ...input,
    releaseStatus: "ended",
    isPrivate: false,
    playtimeMinutes: null,
    pageCount: null,
    chapterCount: null,
    volumeCount: null,
    routeCount: null,
    status: "saved",
    progress: 0,
    progressTotal: input.episodeCount,
    progressUnit: "episodes",
    favorite: false,
    completedAt: null,
    trackedOn: null,
    sharedWith: [],
    studios: input.contributors
      .filter(({ role }) => role === "animation-studio")
      .map(({ name }) => name),
    scoreComponents: {},
    watchDates: noWatchDates,
    publication: null,
    curation: {
      reviewedAt: "",
      status: "provisional",
      notes: "Added from a user-requested catalog batch; metadata is sourced below.",
    },
    relations: [],
    creator:
      input.contributors.find(({ role }) => role === "director")?.name ??
      input.contributors[0]?.name ??
      "",
    imagePath: null,
    bannerPath: null,
    logoPath: null,
  };
}

const entries = [
  entry({
    title: "The Secret Garden",
    arabicTitle: "الحديقة السرية",
    kind: "anime",
    year: 1991,
    planetId: "planet-emerald",
    runtimeMinutes: 25,
    episodeCount: 39,
    summary:
      "بعد وفاة والدي ماري لينوكس، تُرسل من الهند إلى بيت عمها في إنجلترا. هناك تتعرف إلى مارثا وديكون وابن عمها كولن، وتكتشف حديقة مغلقة تصبح مساحة للصداقـة والشفاء وإعادة بناء العائلة.",
    aliases: ["Anime Himitsu no Hanazono", "Himitsu no Hanazono", "アニメ ひみつの花園"],
    genres: ["Drama"],
    tags: ["Female Protagonist", "Child Cast", "Family", "Childhood Classic", "Literary Classic"],
    tone: ["Wholesome", "Emotional", "Reflective"],
    audience: "General",
    country: ["Japan"],
    contentWarnings: "يتم وفقدان، عزلة وحزن، مرض وإعاقة، وتوترات أسرية خفيفة.",
    analysisNotes:
      "تظهر خلفية إنجليزية مسيحية وصلاة عرضاً، لكنها ليست تعليماً لاهوتياً مركزياً في الحكاية.",
    riskProfile: { sexuality: "none", behavioral: "low", theology: "low" },
    releaseStart: "1991-04-19",
    releaseEnd: "1992-03-27",
    sourceMaterial: {
      type: "Novel",
      started: 1911,
      finished: 1911,
      serialization: [],
      publication: null,
    },
    contributors: [
      contributor("Aubec", "organization", "animation-studio", true),
      contributor("Frances Hodgson Burnett", "person", "original-author"),
      contributor("Kouhei Tanaka", "person", "composer"),
    ],
    externalLinks: [
      {
        provider: "anilist",
        label: "AniList",
        url: "https://anilist.co/anime/2810/Himitsu-no-Hanazono",
      },
    ],
  }),
  entry({
    title: "Haikyuu!!",
    arabicTitle: "هايكيو!!",
    kind: "anime",
    year: 2014,
    planetId: "planet-adventure",
    runtimeMinutes: 24,
    episodeCount: 25,
    summary:
      "بعد أن يشاهد شُويو هيناتا لاعباً قصير القامة يسطع في الكرة الطائرة، يعيد إحياء فريق مدرسته. ينضم لاحقاً إلى ثانوية كاراسونو ليجد منافسه توبيو كاغياما زميلاً له، فيتعلمان تحويل الخصومة إلى شراكة تقود الفريق نحو البطولة.",
    aliases: ["HAIKYU!!", "Haikyu!!", "ハイキュー!!"],
    genres: ["Comedy", "Drama", "Sports"],
    tags: ["Volleyball", "School Club", "Male Protagonist", "Ensemble Cast", "Coming-of-Age"],
    tone: ["Energetic", "Emotional", "Wholesome"],
    audience: "Teen",
    country: ["Japan"],
    contentWarnings: "منافسة وضغط رياضي وإصابات رياضية خفيفة، ومشاحنات بين اللاعبين.",
    analysisNotes: "لا توجد مشكلة عقدية جوهرية.",
    riskProfile: { sexuality: "none", behavioral: "low", theology: "none" },
    releaseStart: "2014-04-06",
    releaseEnd: "2014-09-21",
    sourceMaterial: {
      type: "Manga",
      started: 2012,
      finished: 2020,
      serialization: ["Weekly Shōnen Jump"],
      publication: "Shueisha",
    },
    contributors: [
      contributor("Production I.G", "organization", "animation-studio", true),
      contributor("Haruichi Furudate", "person", "original-author"),
      contributor("Susumu Mitsunaka", "person", "director"),
      contributor("Taku Kishimoto", "person", "writer"),
    ],
    externalLinks: [
      { provider: "anilist", label: "AniList", url: "https://anilist.co/anime/20464/Haikyuu" },
    ],
  }),
  entry({
    title: "Les Misérables: Shoujo Cosette",
    arabicTitle: "البؤساء",
    kind: "anime",
    year: 2007,
    planetId: "planet-history",
    runtimeMinutes: 24,
    episodeCount: 52,
    summary:
      "تتابع السلسلة كوزيت في فرنسا القرن التاسع عشر بعد أن تضطر والدتها إلى تركها لدى عائلة تستغلها. يلتقي بها جان فالجان، فيصبح إنقاذها بداية رحلة طويلة عن الرحمة والفقر والعدالة والتحول الشخصي.",
    aliases: ["Les Miserables: Shoujo Cosette", "レ・ミゼラブル 少女コゼット"],
    genres: ["Drama", "Historical", "Slice of Life"],
    tags: ["Female Protagonist", "Child Cast", "Class Conflict", "Literary Classic", "Bullying"],
    tone: ["Emotional", "Reflective", "Bittersweet"],
    audience: "General",
    country: ["Japan"],
    contentWarnings: "فقر واستغلال للأطفال، وفاة ومرض، تنمر وقسوة اجتماعية، سجن وعنف وتهديدات.",
    analysisNotes:
      "تظهر المسيحية والكنيسة ضمن فرنسا التاريخية وشخصيات الرواية، بوصفها جزءاً من البيئة والسياق الأخلاقي للعمل.",
    riskProfile: { sexuality: "none", behavioral: "medium", theology: "low" },
    releaseStart: "2007-01-07",
    releaseEnd: "2007-12-30",
    sourceMaterial: {
      type: "Novel",
      started: 1862,
      finished: 1862,
      serialization: [],
      publication: null,
    },
    contributors: [
      contributor("Nippon Animation", "organization", "animation-studio", true),
      contributor("Victor Hugo", "person", "original-author"),
      contributor("Hiroaki Sakurai", "person", "director"),
      contributor("Tomoko Konparu", "person", "writer"),
    ],
    externalLinks: [
      {
        provider: "anilist",
        label: "AniList",
        url: "https://anilist.co/anime/1695/Les-Misrables-Shoujo-Cosette",
      },
    ],
  }),
  entry({
    title: "Muka Muka Paradise",
    arabicTitle: "موكا موكا",
    kind: "anime",
    year: 1993,
    planetId: "planet-bonbon",
    runtimeMinutes: 20,
    episodeCount: 51,
    summary:
      "تحزن أويبا شيكاتاني لأن بيض الزواحف في متجر والدها لم يفقس، فيحضر لها والدها بيضة كبيرة يخرج منها ديناصور أخضر لا يقول إلا «موكا موكا». تقود شهرته العائلة إلى مغامرات مع اختراعات غريبة ورحلات إلى عصور ما قبل التاريخ.",
    aliases: ["Mukamuka", "ムカムカパラダイス"],
    genres: ["Adventure", "Comedy"],
    tags: ["Dinosaurs", "Animals", "Child Cast", "Family", "Childhood Classic"],
    tone: ["Whimsical", "Wholesome", "Energetic"],
    audience: "General",
    country: ["Japan"],
    contentWarnings:
      "خطر بسيط على الأطفال والحيوانات، ومطاردات ومواقف فوضوية مرتبطة بالديناصورات والسفر عبر الزمن.",
    analysisNotes: "يتضمن مغامرات خيالية وسفراً عبر الزمن، من دون منظومة عقدية مركزية.",
    riskProfile: { sexuality: "none", behavioral: "low", theology: "low" },
    releaseStart: "1993-09-04",
    releaseEnd: "1994-09-03",
    sourceMaterial: {
      type: "Manga",
      started: 1993,
      finished: null,
      serialization: [],
      publication: null,
    },
    contributors: [
      contributor("Fumiko Shiba", "person", "original-author"),
      contributor("Katsuyoshi Yatabe", "person", "director"),
    ],
    externalLinks: [
      {
        provider: "anilist",
        label: "AniList",
        url: "https://anilist.co/anime/4086/Muka-Muka-Paradise",
      },
    ],
  }),
  entry({
    title: "Babar",
    arabicTitle: "بابار",
    kind: "series",
    year: 1989,
    planetId: "planet-bonbon",
    runtimeMinutes: 23,
    episodeCount: 65,
    summary:
      "يروي بابار لأطفاله كيف غادر الغابة صغيراً بعد فقدان والدته، وتعلم الحياة في المدينة ثم عاد ليقود مملكة الفيلة. تتبع الحلقات عائلته وأصدقاءه ومغامراتهم الصغيرة في سيليستفيل.",
    aliases: ["Babar the Elephant", "الفيل بابار"],
    genres: ["Adventure", "Comedy", "Drama", "Fantasy", "Slice of Life"],
    tags: ["Animal Cast", "Family", "Childhood Classic", "Child Cast", "Royalty"],
    tone: ["Wholesome", "Whimsical", "Emotional"],
    audience: "General",
    country: ["Canada", "France"],
    contentWarnings: "فقدان الوالدين، خطر الصيد والعنف الخفيف، ومواقف مغامرة أو خوف بسيطة.",
    analysisNotes: "حكاية خيالية عن مملكة حيوانات ناطقة؛ لا توجد منظومة عقدية مركزية.",
    riskProfile: { sexuality: "none", behavioral: "low", theology: "none" },
    releaseStart: "1989-01-03",
    releaseEnd: "1991-06-05",
    sourceMaterial: {
      type: "Children's Book",
      started: 1931,
      finished: null,
      serialization: [],
      publication: null,
    },
    contributors: [
      contributor("Nelvana", "organization", "animation-studio", true),
      contributor("Jean de Brunhoff", "person", "original-author"),
      contributor("Laurent de Brunhoff", "person", "original-author"),
      contributor("Raymond Jafelice", "person", "director"),
    ],
    externalLinks: [
      { provider: "thetvdb", label: "TheTVDB", url: "https://thetvdb.com/series/babar" },
    ],
  }),
] satisfies CatalogEntry[];

for (const catalogEntry of entries) {
  const existing = listWorks().find(({ title }) => title === catalogEntry.title);
  const work =
    existing ??
    createWork({
      title: catalogEntry.title,
      kind: catalogEntry.kind,
      year: catalogEntry.year,
      status: "saved",
      isPrivate: false,
      summary: catalogEntry.summary,
    });
  updateWork({ id: work.id, ...catalogEntry });
}

console.log(`Seeded ${entries.length} requested animation records.`);
