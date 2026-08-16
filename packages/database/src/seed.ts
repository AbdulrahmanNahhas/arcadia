import { taxonomySeeds } from "@arcadia/domain";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const tableByVocabulary = { genres: "genres", tones: "tones", tags: "tags" } as const;
for (const seed of taxonomySeeds()) {
  const table = tableByVocabulary[seed.vocabulary];
  await sql`insert into ${sql(table)} (slug, label_en, label_ar, position) values (${seed.slug}, ${seed.labelEn}, ${seed.labelAr}, ${seed.position}) on conflict (slug) do update set label_en=excluded.label_en, label_ar=excluded.label_ar, position=excluded.position`;
}

const demoAccounts = [
  {
    accountId: "00000000-0000-4000-8000-000000000001",
    authUserId: "arcadia-demo-owner",
    username: "admin",
    password: process.env.ARCADIA_DEMO_ADMIN_PASSWORD ?? "ArcadiaAdmin!2026",
    displayName: "مدير أركاديا",
    kind: "admin",
    role: "owner",
    avatarKey: "orbit-1",
    policy: ["adult", "18+", "high", "high", "high"],
    restriction: ["adult", "18+", "high", "high", "high"],
    capabilities: [
      "catalog.view",
      "catalog.edit",
      "people.edit",
      "studios.edit",
      "awards.edit",
      "accounts.manage",
      "policies.manage",
      "social.moderate",
      "media.manage",
      "analytics.view",
    ],
  },
  {
    accountId: "00000000-0000-4000-8000-000000000002",
    authUserId: "arcadia-demo-family",
    username: "family",
    password: process.env.ARCADIA_DEMO_FAMILY_PASSWORD ?? "ArcadiaFamily!2026",
    displayName: "ليلة العائلة",
    kind: "family",
    role: "member",
    avatarKey: "orbit-3",
    policy: ["teen", "13+", "low", "medium", "low"],
    restriction: ["teen", "13+", "low", "medium", "low"],
    capabilities: ["catalog.view"],
  },
  {
    accountId: "00000000-0000-4000-8000-000000000003",
    authUserId: "arcadia-demo-personal",
    username: "personal",
    password: process.env.ARCADIA_DEMO_PERSONAL_PASSWORD ?? "ArcadiaPersonal!2026",
    displayName: "المستكشف",
    kind: "personal",
    role: "member",
    avatarKey: "orbit-5",
    policy: ["young-adult", "16+", "medium", "high", "medium"],
    restriction: ["young-adult", "16+", "low", "high", "medium"],
    capabilities: ["catalog.view"],
  },
] as const;

if (process.env.ARCADIA_SEED_DEMO_ACCOUNTS === "true") {
  for (const demo of demoAccounts) {
    const password = await hashPassword(demo.password);
    await sql`insert into auth_users
      (id, name, email, email_verified, username, display_username, role)
      values (${demo.authUserId}, ${demo.displayName},
        ${`${demo.username}@users.arcadia.invalid`}, true, ${demo.username},
        ${demo.username}, ${demo.role}) on conflict (id) do update set
        name=excluded.name, username=excluded.username, display_username=excluded.display_username,
        role=excluded.role, updated_at=now()`;
    await sql`insert into auth_accounts
      (id, account_id, provider_id, user_id, password)
      values (${`credential:${demo.authUserId}`}, ${demo.authUserId}, 'credential',
        ${demo.authUserId}, ${password}) on conflict (provider_id, account_id) do update set
        password=excluded.password, updated_at=now()`;
    await sql`insert into accounts
      (id, auth_user_id, kind, status, slug, display_name, avatar_key, bio)
      values (${demo.accountId}, ${demo.authUserId}, ${demo.kind}, 'active', ${demo.username},
        ${demo.displayName}, ${demo.avatarKey}, 'حساب تطوير محلي لعائلة أركاديا.')
      on conflict (id) do update set auth_user_id=excluded.auth_user_id, kind=excluded.kind,
        status='active', slug=excluded.slug, display_name=excluded.display_name,
        avatar_key=excluded.avatar_key, updated_at=now()`;
    await sql`insert into account_preferences (account_id) values (${demo.accountId})
      on conflict (account_id) do nothing`;
    await sql`insert into account_content_policies
      (account_id, audience, age, sexuality_risk, behavioral_risk, theology_risk)
      values (${demo.accountId}, ${demo.policy[0]}, ${demo.policy[1]}, ${demo.policy[2]},
        ${demo.policy[3]}, ${demo.policy[4]}) on conflict (account_id) do update set
        audience=excluded.audience, age=excluded.age, sexuality_risk=excluded.sexuality_risk,
        behavioral_risk=excluded.behavioral_risk, theology_risk=excluded.theology_risk`;
    await sql`insert into account_admin_restrictions
      (account_id, audience, age, sexuality_risk, behavioral_risk, theology_risk)
      values (${demo.accountId}, ${demo.restriction[0]}, ${demo.restriction[1]},
        ${demo.restriction[2]}, ${demo.restriction[3]}, ${demo.restriction[4]})
      on conflict (account_id) do update set audience=excluded.audience, age=excluded.age,
        sexuality_risk=excluded.sexuality_risk, behavioral_risk=excluded.behavioral_risk,
        theology_risk=excluded.theology_risk`;
    await sql`delete from account_capabilities where account_id=${demo.accountId}`;
    for (const capability of demo.capabilities) {
      await sql`insert into account_capabilities (account_id, capability)
        values (${demo.accountId}, ${capability})`;
    }
  }
}
await sql.end();
console.log(
  `Seeded ${taxonomySeeds().length} controlled taxonomy values${
    process.env.ARCADIA_SEED_DEMO_ACCOUNTS === "true" ? " and 3 development accounts" : ""
  }.`,
);
