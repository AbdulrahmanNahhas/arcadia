import Database from "better-sqlite3"
import { createHash } from "node:crypto"
import { join, resolve } from "node:path"
import { tagLabelsAr as uiTagLabelsAr } from "../src/features/library/model"

type Vocabulary = "genre" | "tone" | "tag"

type WorkRow = {
  id: string
  kind: string
  title: string
  summary: string
}

type TermRow = {
  workId: string
  vocabulary: Vocabulary
  name: string
}

type Taxonomy = {
  genres: string[]
  tones: string[]
  tags: string[]
}

const databasePath = resolve(
  process.env.ARCADIA_DB_PATH ?? join(process.cwd(), "data", "arcadia.db")
)
const dryRun = process.argv.includes("--dry-run")
const sourceArgument = process.argv.find((argument) =>
  argument.startsWith("--source=")
)
const sourceDatabasePath = sourceArgument
  ? resolve(sourceArgument.slice("--source=".length))
  : databasePath

const genresAr = {
  Action: "أكشن",
  Adventure: "مغامرة",
  Comedy: "كوميديا",
  Crime: "جريمة",
  Drama: "دراما",
  Fantasy: "فانتازيا",
  Historical: "تاريخي",
  Horror: "رعب",
  Mecha: "ميكا",
  Music: "موسيقى",
  Mystery: "غموض",
  Psychological: "نفسي",
  Romance: "رومانسية",
  "Science Fiction": "خيال علمي",
  "Slice of Life": "شريحة من الحياة",
  Sports: "رياضة",
  Supernatural: "خوارق",
  Thriller: "إثارة",
  War: "حرب",
} as const

const tonesAr = {
  Wholesome: "دافئ",
  Emotional: "عاطفي",
  Bittersweet: "حلو ومر",
  Reflective: "تأملي",
  Tense: "متوتر",
  Energetic: "حماسي",
  Dark: "قاتم",
  Whimsical: "خيالي مرح",
  Epic: "ملحمي",
  Atmospheric: "غني بالأجواء",
} as const

const tagsAr = {
  "Adult Cast": "شخصيات بالغة",
  Adoption: "التبنّي",
  Agriculture: "الزراعة",
  Aliens: "كائنات فضائية",
  "Animal Cast": "شخصيات حيوانية",
  Animals: "الحيوانات",
  Anthology: "قصص مختارة",
  Antihero: "بطل مضاد",
  Art: "الفن",
  "Artificial Intelligence": "الذكاء الاصطناعي",
  Assassins: "القتلة المأجورون",
  Badminton: "الريشة الطائرة",
  Basketball: "كرة السلة",
  "Body Horror": "رعب جسدي",
  Bullying: "التنمّر",
  "Cat and Mouse": "مطاردة القط والفأر",
  "Child Cast": "شخصيات طفولية",
  "Childhood Classic": "كلاسيكيات الطفولة",
  Censorship: "الرقابة",
  "Class Conflict": "الصراع الطبقي",
  Cohabitation: "السكن المشترك",
  College: "الجامعة",
  "Coming-of-Age": "النضج",
  Conspiracy: "المؤامرة",
  Cooking: "الطبخ",
  "Corporate Power": "نفوذ الشركات",
  "Crime Organization": "منظمة إجرامية",
  Curses: "اللعنات",
  Cyberpunk: "سايبربانك",
  "Dark Fantasy": "فانتازيا مظلمة",
  Demons: "الشياطين",
  Detective: "التحقيق البوليسي",
  Disability: "الإعاقة",
  "Detailed Worldbuilding": "بناء عالم مفصّل",
  Dragons: "التنانين",
  Dungeons: "الزنزانات",
  Dystopia: "ديستوبيا",
  Education: "التعليم",
  "Ensemble Cast": "بطولة جماعية",
  Environment: "البيئة",
  Episodic: "حلقات مستقلة",
  "Epic Fantasy": "فانتازيا ملحمية",
  Espionage: "التجسس",
  "Fairy Tales": "حكايات خرافية",
  Family: "العائلة",
  "Family Life": "الحياة العائلية",
  "Female Protagonist": "بطلة",
  Folklore: "الموروث الشعبي",
  Football: "كرة القدم",
  "Found Family": "العائلة المختارة",
  Friendship: "الصداقة",
  Fugitive: "مطارد",
  Gods: "الآلهة",
  Grief: "الفقد",
  Guns: "الأسلحة النارية",
  Healing: "التعافي",
  "Hidden Identity": "هوية مخفية",
  Identity: "الهوية",
  "Idol Industry": "صناعة الآيدول",
  Immortality: "الخلود",
  Investigation: "التحقيق",
  "Island Setting": "بيئة جزيرية",
  Kaiju: "وحوش عملاقة",
  "Literary Classic": "كلاسيكيات أدبية",
  "Lost Civilization": "حضارة مفقودة",
  "Love Triangle": "مثلث عاطفي",
  Magic: "السحر",
  "Male Protagonist": "بطل ذكر",
  Manipulation: "التلاعب",
  Marriage: "الزواج",
  "Martial Arts": "فنون قتالية",
  "Maritime Setting": "بيئة بحرية",
  Medicine: "الطب",
  Memory: "الذاكرة",
  "Mental Health": "الصحة النفسية",
  "Mind Games": "ألعاب ذهنية",
  Military: "عسكري",
  Monsters: "الوحوش",
  "Moral Ambiguity": "غموض أخلاقي",
  Mortality: "الفناء",
  "Murder Mystery": "لغز جريمة قتل",
  Mythology: "الأساطير",
  "Natural Disaster": "كارثة طبيعية",
  Necromancy: "استحضار الموتى",
  "Nonhuman Characters": "شخصيات غير بشرية",
  "Otaku Culture": "ثقافة الأوتاكو",
  "Overpowered Protagonist": "بطل فائق القوة",
  Parenthood: "الأبوّة والأمومة",
  "Peace and Nonviolence": "السلام واللاعنف",
  Philosophy: "الفلسفة",
  Pirates: "القراصنة",
  Police: "الشرطة",
  "Political Intrigue": "مكائد سياسية",
  "Post-Apocalyptic": "ما بعد الكارثة",
  Prejudice: "التحيّز",
  "Prehistoric Life": "حياة ما قبل التاريخ",
  Propaganda: "الدعاية السياسية",
  Racing: "السباقات",
  Rebellion: "التمرد",
  Redemption: "الخلاص",
  Regret: "الندم",
  Reincarnation: "التناسخ",
  Religion: "الدين",
  Revenge: "الانتقام",
  Rivalry: "التنافس",
  Robots: "الروبوتات",
  "Royal Court": "البلاط الملكي",
  "Rural Setting": "بيئة ريفية",
  Samurai: "الساموراي",
  School: "المدرسة",
  "School Club": "نادٍ مدرسي",
  "Sibling Relationship": "علاقة الأشقاء",
  Slavery: "العبودية",
  "Slow Burn": "تطور بطيء",
  "Social Anxiety": "القلق الاجتماعي",
  "Special Abilities": "قدرات خاصة",
  Spirits: "الأرواح",
  Steampunk: "ستيمبانك",
  "Student Council": "مجلس الطلبة",
  Survival: "البقاء",
  Swordplay: "المبارزة بالسيوف",
  "Tabletop Role-Playing": "ألعاب تقمص الأدوار الطاولة",
  "Teen Cast": "شخصيات مراهقة",
  Technology: "التقنية",
  "Time Loop": "حلقة زمنية",
  "Time Travel": "السفر عبر الزمن",
  Totalitarianism: "الشمولية",
  Toys: "الألعاب",
  Training: "التدريب",
  "Transported to Another World": "الانتقال إلى عالم آخر",
  Travel: "السفر",
  "Undercover Mission": "مهمة سرية",
  Underdog: "شخصية مستضعفة",
  "Urban Setting": "بيئة حضرية",
  "Video Games": "ألعاب الفيديو",
  "Virtual Reality": "الواقع الافتراضي",
  "Virtual World": "عالم افتراضي",
  Vikings: "الفايكنغ",
  "Weird Fiction": "خيال غرائبي",
  Witches: "الساحرات",
  Workplace: "مكان العمل",
  Writing: "الكتابة",
} as const

const tagAliases: Readonly<Record<string, string | null>> = {
  "Adult Cast": "Adult Cast",
  Adoption: "Adoption",
  Agriculture: "Agriculture",
  Alien: "Aliens",
  Amnesia: "Memory",
  Animals: "Animals",
  "Animal Cast": "Animal Cast",
  Anthology: "Anthology",
  Antihero: "Antihero",
  Art: "Art",
  "Artificial Intelligence": "Artificial Intelligence",
  Assassins: "Assassins",
  Aviation: null,
  "Battle Royale": "Tournament",
  "Body Horror": "Body Horror",
  Bullying: "Bullying",
  "Cat and Mouse": "Cat and Mouse",
  Censorship: "Censorship",
  "Child Cast": "Child Cast",
  "City Life": "Urban Setting",
  "Class Conflict": "Class Conflict",
  "Classic Literature": "Childhood Classic",
  Cohabitation: "Cohabitation",
  College: "College",
  "Coming-of-Age": "Coming-of-Age",
  Conspiracy: "Conspiracy",
  Cooking: "Cooking",
  "Corporate Satire": "Corporate Power",
  "Crime Organization": "Crime Organization",
  Curses: "Curses",
  Cyberpunk: "Cyberpunk",
  Dnd: "Tabletop Role-Playing",
  "Dark Fantasy": "Dark Fantasy",
  Demons: "Demons",
  Detective: "Detective",
  Disability: "Disability",
  Dramatic: null,
  Dungeons: "Dungeons",
  Dystopian: "Dystopia",
  Educational: "Education",
  "Ensemble Cast": "Ensemble Cast",
  Environmental: "Environment",
  Episodic: "Episodic",
  Espionage: "Espionage",
  Existentialism: "Philosophy",
  "Female Protagonist": "Female Protagonist",
  Folklore: "Folklore",
  "Foreign Setting": null,
  "Found Family": "Found Family",
  Friendship: "Friendship",
  Fugitive: "Fugitive",
  Gods: "Gods",
  Gore: null,
  "Growing Up": "Coming-of-Age",
  Guns: "Guns",
  Healing: "Healing",
  Heroic: null,
  "Hidden Identity": "Hidden Identity",
  "High Fantasy": "Epic Fantasy",
  Hotel: null,
  Identity: "Identity",
  Idol: "Idol Industry",
  Immortality: "Immortality",
  Inspirational: null,
  Introvert: "Social Anxiety",
  Inventive: null,
  Investigation: "Investigation",
  Island: "Island Setting",
  Isekai: "Transported to Another World",
  Iyashikei: null,
  Journey: "Travel",
  Kaiju: "Kaiju",
  Kids: "Child Cast",
  "Lost Civilization": "Lost Civilization",
  "Love Triangle": "Love Triangle",
  Magic: "Magic",
  "Male Protagonist": "Male Protagonist",
  Manipulation: "Manipulation",
  Marriage: "Marriage",
  "Martial Arts": "Martial Arts",
  Medieval: null,
  Medicine: "Medicine",
  Memory: "Memory",
  "Mental Health": "Mental Health",
  "Mental Illness": "Mental Health",
  "Mind Games": "Mind Games",
  Military: "Military",
  Minions: null,
  Monsters: "Monsters",
  "Moral Ambiguity": "Moral Ambiguity",
  "Moral Philosophy": "Philosophy",
  Mortality: "Mortality",
  "Murder Mystery": "Murder Mystery",
  Mythology: "Mythology",
  "Natural Disaster": "Natural Disaster",
  Naval: "Maritime Setting",
  "Near Future": "Technology",
  Necromancy: "Necromancy",
  "Nonlinear Story": null,
  Orphan: "Adoption",
  Otaku: "Otaku Culture",
  "Otaku Culture": "Otaku Culture",
  Outdoors: "Rural Setting",
  "Overpowered Protagonist": "Overpowered Protagonist",
  Pacifism: "Peace and Nonviolence",
  Parenthood: "Parenthood",
  Parody: null,
  "Period Setting": null,
  Philosophy: "Philosophy",
  Pirates: "Pirates",
  Police: "Police",
  Political: "Political Intrigue",
  "Post-Apocalyptic": "Post-Apocalyptic",
  "Prehistoric Animals": "Prehistoric Life",
  Prejudice: "Prejudice",
  Propaganda: "Propaganda",
  Psychological: null,
  Racing: "Racing",
  Rebellion: "Rebellion",
  Redemption: "Redemption",
  Regret: "Regret",
  Reincarnation: "Reincarnation",
  Religion: "Religion",
  Revenge: "Revenge",
  Rivalry: "Rivalry",
  Robots: "Robots",
  Romantic: null,
  Royalty: "Royal Court",
  Rural: "Rural Setting",
  Samurai: "Samurai",
  School: "School",
  "School Club": "School Club",
  Shapeshifting: "Special Abilities",
  Shounen: null,
  Siblings: "Sibling Relationship",
  Silly: null,
  Slapstick: null,
  Slavery: "Slavery",
  "Slow Burn": "Slow Burn",
  "Social Anxiety": "Social Anxiety",
  "Special Abilities": "Special Abilities",
  Spirits: "Spirits",
  Steampunk: "Steampunk",
  Strategy: "Political Intrigue",
  "Strong Female Lead": "Female Protagonist",
  "Student Council": "Student Council",
  Superhero: "Special Abilities",
  Supervillains: "Crime Organization",
  Survival: "Survival",
  Swordplay: "Swordplay",
  "Teen Cast": "Teen Cast",
  "Time Loop": "Time Loop",
  "Time Travel": "Time Travel",
  Totalitarianism: "Totalitarianism",
  Toys: "Toys",
  "Training Arc": "Training",
  Trauma: "Trauma",
  Travel: "Travel",
  Underdog: "Underdog",
  Urban: "Urban Setting",
  "Urban Fantasy": "Magic",
  "Video Games": "Video Games",
  Vikings: "Vikings",
  "Virtual Reality": "Virtual Reality",
  War: null,
  Western: null,
  "Weird Fiction": "Weird Fiction",
  Witches: "Witches",
  Witty: null,
  Work: "Workplace",
  Workplace: "Workplace",
  Worldbuilding: "Detailed Worldbuilding",
  Writing: "Writing",
  Yakuza: "Crime Organization",
  "Chosen One": null,
  Comedic: null,
  Cars: "Racing",
  Chaotic: null,
} as const

const genreOverrides: Readonly<Record<string, readonly string[]>> = {
  "70b8d9cf-196c-49b1-a14a-a3209b3a0010": ["Crime", "Mystery"],
  "8e7c62b6-1e7b-43f1-bda7-11afeefc0e17": [
    "Drama",
    "Fantasy",
    "Mystery",
    "Romance",
  ],
  "d5b63412-6366-4865-9052-5ed06cddad04": [
    "Crime",
    "Mystery",
    "Psychological",
    "Thriller",
  ],
  "eb153062-3c72-4d07-9b47-386508ff2f29": [
    "Drama",
    "Psychological",
    "Science Fiction",
  ],
  "680e57b5-e62d-47e0-a0ee-7b909ef8c3b4": ["Adventure", "Drama", "Fantasy"],
  "dba72dd6-6bd8-4798-92c7-26fdba168857": [
    "Adventure",
    "Drama",
    "Fantasy",
    "War",
  ],
  "50b48956-8e06-46ca-b0eb-998734aecb19": ["Crime", "Mystery"],
  "8d5379b2-3587-4f41-8cb4-0829a7e1e1ce": [
    "Adventure",
    "Crime",
    "Mystery",
    "Thriller",
  ],
  "5e39d2de-35fd-41ea-a4b9-ccc93b032d06": ["Crime", "Horror", "Mystery"],
  "56430eb7-ddd8-4c03-b0f5-a15b6be65c46": ["Adventure", "Crime", "Mystery"],
  "e8f397a5-9add-4828-a321-eebbbd83b782": ["Crime", "Mystery", "Psychological"],
  "3977443b-6ef8-4a96-9846-071df75d5a54": ["Crime", "Mystery"],
  "788073f2-8cb6-47ea-bcde-f639ca2395f6": [
    "Drama",
    "Fantasy",
    "Mystery",
    "Psychological",
  ],
  "5970dc26-40e8-4960-8b43-8210fb6f229e": [
    "Adventure",
    "Comedy",
    "Fantasy",
    "Romance",
  ],
}

const toneOverrides: Readonly<Record<string, readonly string[]>> = {
  "70b8d9cf-196c-49b1-a14a-a3209b3a0010": ["Atmospheric", "Tense"],
  "8e7c62b6-1e7b-43f1-bda7-11afeefc0e17": [
    "Atmospheric",
    "Tense",
    "Reflective",
  ],
  "d5b63412-6366-4865-9052-5ed06cddad04": ["Dark", "Tense"],
  "eb153062-3c72-4d07-9b47-386508ff2f29": ["Dark", "Reflective", "Tense"],
  "680e57b5-e62d-47e0-a0ee-7b909ef8c3b4": ["Dark", "Epic", "Tense"],
  "dba72dd6-6bd8-4798-92c7-26fdba168857": ["Dark", "Epic", "Tense"],
  "50b48956-8e06-46ca-b0eb-998734aecb19": ["Atmospheric", "Tense"],
  "8d5379b2-3587-4f41-8cb4-0829a7e1e1ce": ["Tense", "Energetic"],
  "5e39d2de-35fd-41ea-a4b9-ccc93b032d06": ["Atmospheric", "Dark", "Tense"],
  "56430eb7-ddd8-4c03-b0f5-a15b6be65c46": ["Energetic", "Tense"],
  "e8f397a5-9add-4828-a321-eebbbd83b782": ["Reflective", "Tense"],
  "3977443b-6ef8-4a96-9846-071df75d5a54": ["Atmospheric", "Tense"],
  "788073f2-8cb6-47ea-bcde-f639ca2395f6": ["Dark", "Tense", "Epic"],
  "5970dc26-40e8-4960-8b43-8210fb6f229e": [
    "Whimsical",
    "Warm",
    "Energetic",
  ].map((value) => (value === "Warm" ? "Wholesome" : value)),
  "obsidian-animation-tv-lona": ["Atmospheric", "Dark", "Tense"],
  "obsidian-animation-tv-sparks-of-tomorrow": [
    "Atmospheric",
    "Emotional",
    "Reflective",
  ],
  "obsidian-animation-movies-ghost-provisional-title": ["Atmospheric"],
}

const extraTags: Readonly<Record<string, readonly string[]>> = {
  "obsidian-animation-tv-aesops-fables": [
    "Animal Cast",
    "Anthology",
    "Childhood Classic",
    "Education",
    "Fairy Tales",
    "Folklore",
    "Literary Classic",
  ],
  "obsidian-animation-tv-arabian-nights-sinbads-adventures": [
    "Childhood Classic",
    "Fairy Tales",
    "Folklore",
    "Literary Classic",
    "Male Protagonist",
    "Maritime Setting",
    "Travel",
  ],
  "obsidian-animation-tv-beyblade-metal-fusion": [
    "Child Cast",
    "Childhood Classic",
    "Friendship",
    "Male Protagonist",
    "Rivalry",
    "Tournament",
    "Training",
  ],
  "obsidian-animation-movies-big-hero-6": [
    "Artificial Intelligence",
    "Found Family",
    "Grief",
    "Invention",
    "Male Protagonist",
    "Robots",
    "Sibling Relationship",
  ],
  "literature-manga-blue-box": [
    "Badminton",
    "Basketball",
    "Female Protagonist",
    "Male Protagonist",
    "Rivalry",
    "School",
    "School Club",
    "Teen Cast",
  ],
  "obsidian-animation-tv-bocchi-the-rock": [
    "Art",
    "Female Protagonist",
    "Friendship",
    "School Club",
    "Teen Cast",
  ],
  "obsidian-animation-movies-cars": [
    "Friendship",
    "Male Protagonist",
    "Nonhuman Characters",
    "Racing",
    "Redemption",
    "Rural Setting",
  ],
  "obsidian-animation-movies-cars-2": [
    "Conspiracy",
    "Espionage",
    "Friendship",
    "Nonhuman Characters",
    "Racing",
    "Travel",
  ],
  "obsidian-animation-movies-cars-3": [
    "Friendship",
    "Identity",
    "Intergenerational Conflict",
    "Male Protagonist",
    "Nonhuman Characters",
    "Racing",
    "Rivalry",
    "Training",
  ],
  "obsidian-animation-movies-coco": [
    "Child Cast",
    "Family",
    "Folklore",
    "Male Protagonist",
    "Memory",
    "Mortality",
    "Spirits",
    "Travel",
  ],
  "obsidian-animation-tv-kami-sama-minarai-himitsu-no-cocotama": [
    "Child Cast",
    "Childhood Classic",
    "Female Protagonist",
    "Friendship",
    "Magic",
    "Spirits",
  ],
  "obsidian-animation-tv-cookin-idol-ai-mai-main": [
    "Child Cast",
    "Childhood Classic",
    "Cooking",
    "Education",
    "Female Protagonist",
    "Idol Industry",
  ],
  "obsidian-animation-movies-despicable-me": [
    "Adoption",
    "Child Cast",
    "Crime Organization",
    "Family",
    "Male Protagonist",
    "Parenthood",
    "Redemption",
  ],
  "obsidian-animation-movies-despicable-me-2": [
    "Adoption",
    "Child Cast",
    "Crime Organization",
    "Family",
    "Male Protagonist",
    "Parenthood",
  ],
  "obsidian-animation-movies-despicable-me-3": [
    "Child Cast",
    "Crime Organization",
    "Family",
    "Male Protagonist",
    "Parenthood",
    "Sibling Relationship",
  ],
  "obsidian-animation-tv-don-chuck-story": [
    "Animal Cast",
    "Animals",
    "Childhood Classic",
    "Episodic",
    "Friendship",
    "Rural Setting",
  ],
  "obsidian-animation-tv-manga-fairy-tales-of-the-world": [
    "Anthology",
    "Childhood Classic",
    "Fairy Tales",
    "Folklore",
    "Literary Classic",
  ],
  "obsidian-animation-tv-grimms-fairy-tale-classics": [
    "Animal Cast",
    "Anthology",
    "Childhood Classic",
    "Fairy Tales",
    "Folklore",
    "Literary Classic",
  ],
  "obsidian-animation-tv-historie": [
    "Adult Cast",
    "Male Protagonist",
    "Military",
    "Political Intrigue",
    "Slavery",
    "Travel",
  ],
  "obsidian-animation-movies-hotel-transylvania": [
    "Family",
    "Female Protagonist",
    "Male Protagonist",
    "Monsters",
    "Nonhuman Characters",
    "Parenthood",
  ],
  "obsidian-animation-movies-hotel-transylvania-2": [
    "Family",
    "Intergenerational Conflict",
    "Monsters",
    "Nonhuman Characters",
    "Parenthood",
    "Prejudice",
  ],
  "obsidian-animation-movies-hotel-transylvania-3-summer-vacation": [
    "Family",
    "Monsters",
    "Nonhuman Characters",
    "Prejudice",
    "Travel",
  ],
  "obsidian-animation-movies-how-to-train-your-dragon": [
    "Coming-of-Age",
    "Dragons",
    "Friendship",
    "Male Protagonist",
    "Peace and Nonviolence",
    "Teen Cast",
    "Training",
  ],
  "obsidian-animation-movies-how-to-train-your-dragon-2": [
    "Dragons",
    "Family",
    "Friendship",
    "Grief",
    "Male Protagonist",
    "Military",
    "Travel",
  ],
  "obsidian-animation-movies-ice-age": [
    "Animal Cast",
    "Found Family",
    "Nonhuman Characters",
    "Prehistoric Life",
    "Survival",
    "Travel",
  ],
  "obsidian-animation-movies-ice-age-continental-drift": [
    "Animal Cast",
    "Family",
    "Found Family",
    "Maritime Setting",
    "Nonhuman Characters",
    "Prehistoric Life",
    "Survival",
  ],
  "obsidian-animation-movies-ice-age-dawn-of-the-dinosaurs": [
    "Animal Cast",
    "Family",
    "Found Family",
    "Nonhuman Characters",
    "Parenthood",
    "Prehistoric Life",
    "Survival",
  ],
  "obsidian-animation-movies-ice-age-the-meltdown": [
    "Animal Cast",
    "Found Family",
    "Natural Disaster",
    "Nonhuman Characters",
    "Prehistoric Life",
    "Survival",
  ],
  "literature-manga-ichi-the-witch": [
    "Magic",
    "Male Protagonist",
    "Monsters",
    "Special Abilities",
    "Training",
    "Underdog",
    "Witches",
  ],
  "obsidian-animation-movies-incredibles-2": [
    "Adult Cast",
    "Ensemble Cast",
    "Family",
    "Female Protagonist",
    "Hidden Identity",
    "Special Abilities",
  ],
  "obsidian-animation-movies-inside-out": [
    "Child Cast",
    "Coming-of-Age",
    "Family",
    "Female Protagonist",
    "Identity",
    "Memory",
    "Mental Health",
  ],
  "obsidian-animation-tv-jaadugar": [
    "Education",
    "Female Protagonist",
    "Political Intrigue",
    "Revenge",
    "Royal Court",
    "Slavery",
    "Undercover Mission",
  ],
  "obsidian-animation-movies-kung-fu-panda": [
    "Animal Cast",
    "Friendship",
    "Male Protagonist",
    "Martial Arts",
    "Training",
    "Underdog",
  ],
  "obsidian-animation-movies-kung-fu-panda-2": [
    "Animal Cast",
    "Grief",
    "Male Protagonist",
    "Martial Arts",
    "Peace and Nonviolence",
    "Revenge",
    "Trauma",
  ],
  "obsidian-animation-movies-kung-fu-panda-3": [
    "Animal Cast",
    "Family",
    "Identity",
    "Male Protagonist",
    "Martial Arts",
    "Training",
  ],
  "obsidian-animation-tv-lbx-little-battlers-experience": [
    "Child Cast",
    "Childhood Classic",
    "Friendship",
    "Male Protagonist",
    "Robots",
    "Technology",
    "Tournament",
  ],
  "obsidian-animation-tv-little-women-ii-jos-boys": [
    "Child Cast",
    "Childhood Classic",
    "Education",
    "Family Life",
    "Female Protagonist",
    "Literary Classic",
    "School",
  ],
  "obsidian-animation-tv-lucy-may-of-the-southern-rainbow": [
    "Child Cast",
    "Childhood Classic",
    "Family Life",
    "Female Protagonist",
    "Rural Setting",
    "Survival",
    "Travel",
  ],
  "obsidian-animation-movies-madagascar": [
    "Animal Cast",
    "Found Family",
    "Friendship",
    "Island Setting",
    "Nonhuman Characters",
    "Travel",
  ],
  "obsidian-animation-movies-madagascar-3-europes-most-wanted": [
    "Animal Cast",
    "Found Family",
    "Friendship",
    "Nonhuman Characters",
    "Travel",
    "Workplace",
  ],
  "obsidian-animation-movies-madagascar-escape-2-africa": [
    "Animal Cast",
    "Family",
    "Found Family",
    "Friendship",
    "Identity",
    "Nonhuman Characters",
    "Travel",
  ],
  "obsidian-animation-tv-mama-is-a-4th-grader": [
    "Child Cast",
    "Childhood Classic",
    "Coming-of-Age",
    "Family Life",
    "Female Protagonist",
    "Parenthood",
    "School",
    "Time Travel",
  ],
  "obsidian-animation-movies-minions": [
    "Crime Organization",
    "Found Family",
    "Nonhuman Characters",
    "Travel",
    "Undercover Mission",
  ],
  "obsidian-animation-movies-minions-the-rise-of-gru": [
    "Child Cast",
    "Crime Organization",
    "Found Family",
    "Male Protagonist",
    "Nonhuman Characters",
    "Training",
  ],
  "literature-novel-mistborn-era-1": [
    "Class Conflict",
    "Crime Organization",
    "Detailed Worldbuilding",
    "Epic Fantasy",
    "Female Protagonist",
    "Found Family",
    "Immortality",
    "Magic",
    "Political Intrigue",
    "Rebellion",
    "Royal Court",
  ],
  "obsidian-animation-movies-monsters-university": [
    "College",
    "Coming-of-Age",
    "Friendship",
    "Male Protagonist",
    "Monsters",
    "Nonhuman Characters",
    "Rivalry",
  ],
  "obsidian-animation-movies-monsters-inc": [
    "Child Cast",
    "Corporate Power",
    "Found Family",
    "Friendship",
    "Male Protagonist",
    "Monsters",
    "Workplace",
  ],
  "obsidian-animation-movies-next-gen": [
    "Artificial Intelligence",
    "Corporate Power",
    "Female Protagonist",
    "Friendship",
    "Robots",
    "Teen Cast",
    "Technology",
  ],
  "5f659e22-3491-40f9-87c0-5a8950925001": [
    "Censorship",
    "Dystopia",
    "Literary Classic",
    "Male Protagonist",
    "Manipulation",
    "Memory",
    "Rebellion",
  ],
  "obsidian-animation-movies-penguins-of-madagascar": [
    "Animal Cast",
    "Conspiracy",
    "Espionage",
    "Found Family",
    "Nonhuman Characters",
    "Travel",
  ],
  "obsidian-animation-tv-piperos-adventures-adventures-of-pepero-the-andes-boy":
    [
      "Child Cast",
      "Childhood Classic",
      "Lost Civilization",
      "Male Protagonist",
      "Rescue Mission",
      "Rural Setting",
      "Travel",
    ],
  "obsidian-animation-movies-ratatouille": [
    "Animal Cast",
    "Art",
    "Cooking",
    "Friendship",
    "Male Protagonist",
    "Underdog",
    "Urban Setting",
    "Workplace",
  ],
  "obsidian-animation-movies-rise-of-the-guardians": [
    "Child Cast",
    "Found Family",
    "Male Protagonist",
    "Mythology",
    "Special Abilities",
    "Spirits",
  ],
  "obsidian-animation-tv-robin-hoods-great-adventure": [
    "Childhood Classic",
    "Class Conflict",
    "Friendship",
    "Literary Classic",
    "Male Protagonist",
    "Rebellion",
    "Rural Setting",
  ],
  "obsidian-animation-tv-yokoyama-mitsuteru-sangokushi-romance-of-the-three-kingdoms":
    [
      "Adult Cast",
      "Childhood Classic",
      "Ensemble Cast",
      "Literary Classic",
      "Military",
      "Political Intrigue",
    ],
  "literature-manga-solo-leveling": [
    "Dungeons",
    "Male Protagonist",
    "Monsters",
    "Necromancy",
    "Overpowered Protagonist",
    "Special Abilities",
    "Survival",
    "Training",
  ],
  "obsidian-animation-movies-spider-man-into-the-spider-verse": [
    "Coming-of-Age",
    "Found Family",
    "Male Protagonist",
    "Parallel Worlds",
    "Special Abilities",
    "Teen Cast",
  ],
  "obsidian-animation-movies-sword-art-online-movie": [
    "Artificial Intelligence",
    "Female Protagonist",
    "Male Protagonist",
    "Special Abilities",
    "Swordplay",
    "Virtual Reality",
    "Virtual World",
  ],
  "obsidian-animation-tv-tales-of-little-women": [
    "Childhood Classic",
    "Coming-of-Age",
    "Ensemble Cast",
    "Family Life",
    "Female Protagonist",
    "Literary Classic",
    "Sibling Relationship",
  ],
  "obsidian-animation-movies-the-angry-birds-movie": [
    "Animal Cast",
    "Friendship",
    "Island Setting",
    "Nonhuman Characters",
    "Revenge",
    "Rivalry",
  ],
  "obsidian-animation-movies-the-angry-birds-movie-2": [
    "Animal Cast",
    "Friendship",
    "Island Setting",
    "Nonhuman Characters",
    "Rivalry",
  ],
  "obsidian-animation-movies-the-boss-baby": [
    "Child Cast",
    "Corporate Power",
    "Family",
    "Hidden Identity",
    "Male Protagonist",
    "Sibling Relationship",
  ],
  "obsidian-animation-movies-the-boss-baby-family-business": [
    "Child Cast",
    "Corporate Power",
    "Family",
    "Hidden Identity",
    "Intergenerational Conflict",
    "Sibling Relationship",
  ],
  "obsidian-animation-tv-the-bugle-call-song-of-war": [
    "Magic",
    "Male Protagonist",
    "Military",
    "Political Intrigue",
    "Survival",
    "Workplace",
  ],
  "obsidian-animation-movies-the-incredibles": [
    "Adult Cast",
    "Ensemble Cast",
    "Family",
    "Hidden Identity",
    "Special Abilities",
  ],
  "obsidian-animation-movies-the-lego-movie": [
    "Corporate Power",
    "Friendship",
    "Male Protagonist",
    "Rebellion",
    "Toys",
    "Underdog",
  ],
  "obsidian-animation-movies-the-lion-king": [
    "Animal Cast",
    "Coming-of-Age",
    "Family",
    "Male Protagonist",
    "Redemption",
    "Revenge",
    "Royal Court",
  ],
  "obsidian-animation-tv-mashumaro-taimusu": [
    "Child Cast",
    "Childhood Classic",
    "Episodic",
    "Female Protagonist",
    "Friendship",
    "School",
    "Writing",
  ],
  "obsidian-animation-movies-the-secret-life-of-pets": [
    "Animal Cast",
    "Family",
    "Found Family",
    "Friendship",
    "Nonhuman Characters",
    "Urban Setting",
  ],
  "obsidian-animation-movies-the-secret-life-of-pets-2": [
    "Animal Cast",
    "Episodic",
    "Family",
    "Friendship",
    "Nonhuman Characters",
    "Urban Setting",
  ],
  "obsidian-animation-tv-the-story-of-pollyanna-girl-of-love": [
    "Adoption",
    "Child Cast",
    "Childhood Classic",
    "Female Protagonist",
    "Healing",
    "Literary Classic",
    "Rural Setting",
  ],
  "obsidian-animation-tv-the-swiss-family-robinson-flone-of-the-mysterious-island":
    [
      "Child Cast",
      "Childhood Classic",
      "Family Life",
      "Island Setting",
      "Literary Classic",
      "Survival",
      "Travel",
    ],
  "obsidian-animation-tv-world-famous-fairy-tale-series-wow-marchen-kingdom": [
    "Anthology",
    "Childhood Classic",
    "Fairy Tales",
    "Folklore",
    "Literary Classic",
  ],
  "literature-manga-three-days-of-happiness": [
    "Female Protagonist",
    "Healing",
    "Male Protagonist",
    "Mental Health",
    "Mortality",
    "Philosophy",
    "Regret",
    "Slow Burn",
  ],
  "obsidian-animation-tv-toilet-bound-hanako-kun": [
    "Coming-of-Age",
    "Female Protagonist",
    "Folklore",
    "Male Protagonist",
    "School",
    "Spirits",
  ],
  "obsidian-animation-movies-toy-story": [
    "Coming-of-Age",
    "Found Family",
    "Friendship",
    "Identity",
    "Nonhuman Characters",
    "Toys",
  ],
  "obsidian-animation-movies-toy-story-2": [
    "Coming-of-Age",
    "Found Family",
    "Friendship",
    "Identity",
    "Nonhuman Characters",
    "Toys",
  ],
  "obsidian-animation-movies-toy-story-3": [
    "Coming-of-Age",
    "Found Family",
    "Friendship",
    "Mortality",
    "Nonhuman Characters",
    "Toys",
  ],
  "obsidian-animation-movies-toy-story-4": [
    "Found Family",
    "Friendship",
    "Identity",
    "Nonhuman Characters",
    "Toys",
  ],
  "obsidian-animation-tv-trapp-family-story": [
    "Child Cast",
    "Childhood Classic",
    "Family Life",
    "Female Protagonist",
    "Literary Classic",
    "Parenthood",
  ],
  "obsidian-animation-movies-turbo": [
    "Animal Cast",
    "Friendship",
    "Male Protagonist",
    "Nonhuman Characters",
    "Racing",
    "Training",
    "Underdog",
  ],
  "obsidian-animation-tv-ufo-robot-grendizer": [
    "Aliens",
    "Childhood Classic",
    "Episodic",
    "Kaiju",
    "Male Protagonist",
    "Military",
    "Robots",
  ],
  "obsidian-animation-movies-up": [
    "Adult Cast",
    "Child Cast",
    "Found Family",
    "Friendship",
    "Grief",
    "Healing",
    "Travel",
  ],
  "obsidian-animation-tv-wizards-tales-of-arcadia": [
    "Ensemble Cast",
    "Found Family",
    "Magic",
    "Teen Cast",
    "Time Travel",
    "Detailed Worldbuilding",
  ],
  "83bc45c9-4ebc-4650-a726-02450352f506": [
    "Art",
    "Body Swap",
    "Female Protagonist",
    "Magic",
    "Male Protagonist",
    "Religion",
    "Slow Burn",
    "Spirits",
  ],
  "obsidian-animation-tv-attack-on-titan": ["Moral Ambiguity"],
  "obsidian-animation-tv-blue-box": ["Badminton", "Basketball"],
  "obsidian-animation-tv-captain-tsubasa": ["Football"],
  "obsidian-animation-tv-hell-paradise": ["Samurai"],
  "obsidian-animation-tv-inazuma-eleven": ["Football"],
  "obsidian-animation-tv-monster": ["Moral Ambiguity"],
  "obsidian-animation-tv-my-happy-marriage": ["Arranged Marriage"],
  "obsidian-animation-tv-sword-art-online": ["Virtual World"],
  "obsidian-animation-tv-vinland-saga": ["Moral Ambiguity"],
  "obsidian-animation-movies-your-name": ["Body Swap"],
  "obsidian-animation-movies-zootopia": [
    "Animal Cast",
    "Conspiracy",
    "Detective",
    "Female Protagonist",
    "Friendship",
    "Investigation",
    "Police",
    "Prejudice",
    "Urban Setting",
    "Workplace",
  ],
  "70b8d9cf-196c-49b1-a14a-a3209b3a0010": [
    "Adult Cast",
    "Detective",
    "Investigation",
    "Male Protagonist",
    "Murder Mystery",
    "Literary Classic",
    "Revenge",
  ],
  "8e7c62b6-1e7b-43f1-bda7-11afeefc0e17": [
    "Arranged Marriage",
    "Female Protagonist",
    "Magic",
    "Political Intrigue",
    "Royal Court",
    "Slow Burn",
    "Undercover Mission",
  ],
  "d5b63412-6366-4865-9052-5ed06cddad04": [
    "Adult Cast",
    "Ensemble Cast",
    "Island Setting",
    "Literary Classic",
    "Mind Games",
    "Murder Mystery",
    "Survival",
  ],
  "literature-novel-animal-farm": [
    "Animals",
    "Class Conflict",
    "Literary Classic",
    "Political Intrigue",
    "Rebellion",
  ],
  "eb153062-3c72-4d07-9b47-386508ff2f29": [
    "Adult Cast",
    "Censorship",
    "Dystopia",
    "Literary Classic",
    "Male Protagonist",
    "Rebellion",
    "Totalitarianism",
  ],
  "680e57b5-e62d-47e0-a0ee-7b909ef8c3b4": [
    "Detailed Worldbuilding",
    "Ensemble Cast",
    "Epic Fantasy",
    "Gods",
    "Magic",
    "Rebellion",
    "Survival",
  ],
  "dba72dd6-6bd8-4798-92c7-26fdba168857": [
    "Conspiracy",
    "Detailed Worldbuilding",
    "Ensemble Cast",
    "Epic Fantasy",
    "Magic",
    "Political Intrigue",
    "Survival",
  ],
  "50b48956-8e06-46ca-b0eb-998734aecb19": [
    "Adult Cast",
    "Detective",
    "Ensemble Cast",
    "Investigation",
    "Literary Classic",
    "Murder Mystery",
    "Travel",
  ],
  "8d5379b2-3587-4f41-8cb4-0829a7e1e1ce": [
    "Adult Cast",
    "Conspiracy",
    "Detective",
    "Investigation",
    "Literary Classic",
    "Travel",
  ],
  "5e39d2de-35fd-41ea-a4b9-ccc93b032d06": [
    "Adult Cast",
    "Detective",
    "Investigation",
    "Literary Classic",
    "Male Protagonist",
    "Murder Mystery",
    "Rural Setting",
  ],
  "56430eb7-ddd8-4c03-b0f5-a15b6be65c46": [
    "Adult Cast",
    "Conspiracy",
    "Female Protagonist",
    "Investigation",
    "Literary Classic",
    "Travel",
    "Undercover Mission",
  ],
  "e8f397a5-9add-4828-a321-eebbbd83b782": [
    "Adult Cast",
    "Detective",
    "Investigation",
    "Literary Classic",
    "Mind Games",
    "Murder Mystery",
  ],
  "3977443b-6ef8-4a96-9846-071df75d5a54": [
    "Adult Cast",
    "Detective",
    "Investigation",
    "Literary Classic",
    "Murder Mystery",
    "Rural Setting",
  ],
  "788073f2-8cb6-47ea-bcde-f639ca2395f6": [
    "Class Conflict",
    "Conspiracy",
    "Hidden Identity",
    "Male Protagonist",
    "Political Intrigue",
    "Revenge",
    "School",
  ],
  "5970dc26-40e8-4960-8b43-8210fb6f229e": [
    "Female Protagonist",
    "Maritime Setting",
    "Pirates",
    "Rescue Mission",
    "Travel",
    "Detailed Worldbuilding",
    "Magic",
  ],
  "obsidian-animation-tv-lona": [
    "Adult Cast",
    "Investigation",
    "Memory",
    "Neuroscience",
    "Technology",
    "Workplace",
  ],
  "obsidian-animation-tv-sparks-of-tomorrow": [
    "Coming-of-Age",
    "Invention",
    "Technology",
    "Teen Cast",
    "Political Intrigue",
  ],
  "obsidian-animation-movies-wasted-chef": [
    "Cooking",
    "Memory",
    "Male Protagonist",
    "Post-Apocalyptic",
    "Technology",
  ],
  "obsidian-animation-movies-ghost-provisional-title": [
    "Female Protagonist",
    "Spirits",
  ],
}

const tagDefinitionExtensions = {
  "Anime Movie": "فيلم أنمي",
  "Animated Movie": "فيلم رسوم متحركة",
  "Arranged Marriage": "زواج مدبّر",
  "Body Swap": "تبادل الأجساد",
  Invention: "الاختراع",
  "Intergenerational Conflict": "صراع الأجيال",
  Neuroscience: "علم الأعصاب",
  "Parallel Worlds": "عوالم متوازية",
  "Rescue Mission": "مهمة إنقاذ",
} as const

const allTagsAr: Readonly<Record<string, string>> = {
  ...tagsAr,
  ...tagDefinitionExtensions,
}

const animeMovieIds = new Set([
  "obsidian-animation-movies-silent-voice",
  "obsidian-animation-movies-chainsaw-man-reze-arc",
  "obsidian-animation-movies-demon-slayer-infinity-castle",
  "obsidian-animation-movies-demon-slayer-mugen-train-arc",
  "obsidian-animation-movies-ghost-provisional-title",
  "obsidian-animation-movies-jujutsu-kaisen-0",
  "obsidian-animation-movies-kaguya-sama-first-kiss",
  "obsidian-animation-movies-look-back",
  "obsidian-animation-movies-spy-family-code-white",
  "obsidian-animation-movies-suzume",
  "obsidian-animation-movies-sword-art-online-movie",
  "obsidian-animation-movies-takopis-original-sin-movie",
  "obsidian-animation-movies-the-apothecary-diaries-movie",
  "obsidian-animation-movies-violet-evergarden-eternity-and-the-auto-memory-doll",
  "obsidian-animation-movies-violet-evergarden-the-movie",
  "obsidian-animation-movies-wasted-chef",
  "obsidian-animation-movies-weathering-with-you",
])

const db = new Database(databasePath)
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 5000")
const sourceDb =
  sourceDatabasePath === databasePath
    ? db
    : new Database(sourceDatabasePath, { readonly: true })

const works = db
  .prepare<[], WorkRow>(
    `SELECT id, kind, canonical_title AS title, summary FROM works ORDER BY canonical_title`
  )
  .all()

const termRows = sourceDb
  .prepare<[], TermRow>(
    `SELECT wt.work_id AS workId, t.vocabulary, t.name
     FROM work_terms wt
     JOIN terms t ON t.id = wt.term_id
     WHERE t.vocabulary IN ('genre', 'tone', 'tag')`
  )
  .all()

if (sourceDb !== db) sourceDb.close()

const termsByWork = new Map<string, Map<Vocabulary, string[]>>()
for (const row of termRows) {
  const vocabularies = termsByWork.get(row.workId) ?? new Map()
  const values = vocabularies.get(row.vocabulary) ?? []
  values.push(row.name)
  vocabularies.set(row.vocabulary, values)
  termsByWork.set(row.workId, vocabularies)
}

const knownGenres = new Set(Object.keys(genresAr))
const knownTones = new Set(Object.keys(tonesAr))
const knownTags = new Set(Object.keys(allTagsAr))

const prepared = new Map<string, Taxonomy>()

for (const work of works) {
  const current = termsByWork.get(work.id)
  const oldGenres = current?.get("genre") ?? []
  const oldTones = current?.get("tone") ?? []
  const oldTags = current?.get("tag") ?? []

  const genres = new Set(oldGenres)
  if (oldTags.includes("Psychological")) genres.add("Psychological")
  if (
    oldTags.some((tag) =>
      ["Crime", "Crime Organization", "Detective", "Yakuza"].includes(tag)
    )
  ) {
    genres.add("Crime")
  }
  if (oldTags.includes("Mecha")) genres.add("Mecha")
  if (oldTags.includes("War")) genres.add("War")

  const explicitGenres = genreOverrides[work.id]
  if (explicitGenres) {
    genres.clear()
    explicitGenres.forEach((genre) => genres.add(genre))
  }

  const tones = new Set(
    oldTones.map((tone) => {
      if (tone === "Hype / Energetic") return "Energetic"
      if (tone === "Surreal / Whimsical") return "Whimsical"
      return tone
    })
  )
  if (tones.has("Dark")) tones.delete("Wholesome")
  if (tones.size === 0) {
    if (genres.has("Comedy")) tones.add("Wholesome")
    else if (genres.has("Thriller") || genres.has("Horror")) tones.add("Tense")
    else if (genres.has("Drama")) tones.add("Emotional")
    else tones.add("Atmospheric")
  }

  const explicitTones = toneOverrides[work.id]
  if (explicitTones) {
    tones.clear()
    explicitTones.forEach((tone) => tones.add(tone))
  }

  const tags = new Set<string>()
  for (const oldTag of oldTags) {
    const replacement = tagAliases[oldTag]
    if (replacement) tags.add(replacement)
  }
  extraTags[work.id]?.forEach((tag) => tags.add(tag))
  if (animeMovieIds.has(work.id)) tags.add("Anime Movie")
  else if (work.kind === "movie") tags.add("Animated Movie")

  const taxonomy: Taxonomy = {
    genres: [...genres].filter((genre) => knownGenres.has(genre)).sort(),
    tones: [...tones].filter((tone) => knownTones.has(tone)).sort(),
    tags: [...tags].filter((tag) => knownTags.has(tag)).sort(),
  }
  prepared.set(work.id, taxonomy)
}

const tagFrequency = new Map<string, number>()
for (const taxonomy of prepared.values()) {
  for (const tag of taxonomy.tags) {
    tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1)
  }
}

const problems: string[] = []
for (const work of works) {
  const taxonomy = prepared.get(work.id)!
  if (taxonomy.genres.length === 0) problems.push(`${work.title}: no genres`)
  if (taxonomy.tones.length === 0) problems.push(`${work.title}: no tones`)
  const minimumTags =
    work.id === "obsidian-animation-movies-ghost-provisional-title" ? 2 : 5
  if (taxonomy.tags.length < minimumTags || taxonomy.tags.length > 15) {
    problems.push(`${work.title}: ${taxonomy.tags.length} tags`)
  }
}

const singletonTags = [...tagFrequency]
  .filter(([, count]) => count === 1)
  .map(([tag]) => tag)
  .sort()
const unusedTags = [...knownTags].filter((tag) => !tagFrequency.has(tag)).sort()
const missingUiTranslations = [...tagFrequency.keys()]
  .filter((tag) => !uiTagLabelsAr[tag])
  .sort()
const staleUiTranslations = Object.keys(uiTagLabelsAr)
  .filter((tag) => !tagFrequency.has(tag))
  .sort()

problems.push(
  ...missingUiTranslations.map((tag) => `missing Arabic UI label: ${tag}`),
  ...staleUiTranslations.map((tag) => `stale Arabic UI label: ${tag}`)
)

console.log({
  works: works.length,
  genres: knownGenres.size,
  tones: knownTones.size,
  tags: tagFrequency.size,
  problems: problems.length,
  singletonTags: singletonTags.length,
  dryRun,
  sourceDatabasePath,
})

if (problems.length) console.log("PROBLEMS\n" + problems.join("\n"))
if (singletonTags.length) {
  console.log("SINGLETON TAGS\n" + singletonTags.join("\n"))
}
if (unusedTags.length) console.log("UNUSED TAGS\n" + unusedTags.join("\n"))

if (dryRun || problems.length) {
  db.close()
  if (problems.length) process.exitCode = 1
} else {
  const stableId = (...parts: string[]) =>
    createHash("sha256")
      .update(parts.join(":"), "utf8")
      .digest("hex")
      .slice(0, 32)
  const slug = (value: string) =>
    value
      .toLocaleLowerCase("en-US")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const rebuild = db.transaction(() => {
    const taxonomyTermIds = db
      .prepare<[], { id: string }>(
        `SELECT id FROM terms WHERE vocabulary IN ('genre', 'tone', 'tag')`
      )
      .all()
      .map(({ id }) => id)

    const deleteLinks = db.prepare(`DELETE FROM work_terms WHERE term_id = ?`)
    const deleteTerm = db.prepare(`DELETE FROM terms WHERE id = ?`)
    for (const id of taxonomyTermIds) {
      deleteLinks.run(id)
      deleteTerm.run(id)
    }

    const insertTerm = db.prepare(
      `INSERT INTO terms
       (id, vocabulary, name, slug, label_ar, description, description_ar)
       VALUES (?, ?, ?, ?, ?, '', '')`
    )
    const insertLink = db.prepare(
      `INSERT INTO work_terms (work_id, term_id) VALUES (?, ?)`
    )

    const registries: Array<
      readonly [Vocabulary, Readonly<Record<string, string>>]
    > = [
      ["genre", genresAr],
      ["tone", tonesAr],
      ["tag", allTagsAr],
    ]

    const termIds = new Map<string, string>()
    for (const [vocabulary, registry] of registries) {
      for (const [name, labelAr] of Object.entries(registry)) {
        if (vocabulary === "tag" && !tagFrequency.has(name)) continue
        const id = stableId("term", vocabulary, slug(name))
        insertTerm.run(id, vocabulary, name, slug(name), labelAr)
        termIds.set(`${vocabulary}:${name}`, id)
      }
    }

    for (const [workId, taxonomy] of prepared) {
      const assignments: Array<readonly [Vocabulary, readonly string[]]> = [
        ["genre", taxonomy.genres],
        ["tone", taxonomy.tones],
        ["tag", taxonomy.tags],
      ]
      for (const [vocabulary, values] of assignments) {
        for (const value of values) {
          const termId = termIds.get(`${vocabulary}:${value}`)
          if (!termId) throw new Error(`Unknown ${vocabulary}: ${value}`)
          insertLink.run(workId, termId)
        }
      }
    }
  })

  rebuild()
  db.close()
  console.log("Taxonomy rebuilt successfully.")
}
