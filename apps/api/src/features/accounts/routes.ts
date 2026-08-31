import { createHash, randomBytes } from "node:crypto";
import {
  type AccountCapability,
  type AccountKind,
  type AccountPreferences,
  type AccountRole,
  acceptInviteInputSchema,
  accountPolicyPreviewSchema,
  accountRestrictionEditorSchema,
  adminUpdateAccountInputSchema,
  createAccountInputSchema,
  createInviteInputSchema,
  type FamilyAccount,
  familyAccountSchema,
  updateAccountInputSchema,
} from "@arcadia/contracts";
import type { Classification } from "@arcadia/domain";
import { OpenAPIHono } from "@hono/zod-openapi";
import { auth, getAuthSession, isTestAuthBypass } from "../../auth";
import { database } from "../../database";

type AccountRow = Record<string, unknown>;

const defaultPreferences: AccountPreferences = {
  theme: "dark",
  // Empty means "no configured preference" — the streams route's own ranking then falls back to
  // its original default (an unlabeled/English-flagged release ranks first), rather than this
  // default silently steering every fresh profile toward Arabic before anyone asked for that.
  preferredAudio: [],
  allowedAudio: ["ar", "en"],
  subtitleMode: "allowed",
  canSwitchTracks: true,
  autoplay: false,
  hideSpoilers: true,
  spoilerMode: "cover",
  notifyFamilyActivity: true,
  notifyReplies: true,
  defaultSavedViewId: null,
  homeLayout: {},
  dashboardLayout: {},
};

const policies: Record<AccountKind, Classification> = {
  admin: {
    audience: "adult",
    age: "18+",
    sexuality: "high",
    behavioral: "high",
    theology: "high",
  },
  family: {
    audience: "teen",
    age: "13+",
    sexuality: "low",
    behavioral: "medium",
    theology: "low",
  },
  personal: {
    audience: "young-adult",
    age: "16+",
    sexuality: "medium",
    behavioral: "high",
    theology: "medium",
  },
};

function dateString(value: unknown) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function classification(row: AccountRow, prefix = "") {
  const key = (name: string) =>
    prefix ? `${prefix}${name[0]?.toLocaleUpperCase()}${name.slice(1)}` : name;
  return {
    audience: String(row[key("audience")] ?? "general"),
    age: String(row[key("age")] ?? "all"),
    sexuality: String(row[key("sexuality")] ?? "none"),
    behavioral: String(row[key("behavioral")] ?? "none"),
    theology: String(row[key("theology")] ?? "none"),
  } as Classification;
}

function asRole(value: unknown): AccountRole {
  return value === "owner" || value === "editor" ? value : "member";
}

function mapAccount(row: AccountRow, currentId: string | null): FamilyAccount {
  return familyAccountSchema.parse({
    id: row.id,
    username: row.username ?? null,
    displayName: row.displayName,
    kind: row.kind,
    role: asRole(row.role),
    status: row.status,
    avatarKey: row.avatarKey,
    bio: row.bio ?? "",
    capabilities: row.capabilities ?? [],
    preferences: {
      theme: row.theme ?? defaultPreferences.theme,
      preferredAudio: row.preferredAudio ?? defaultPreferences.preferredAudio,
      allowedAudio: row.allowedAudio ?? defaultPreferences.allowedAudio,
      subtitleMode: row.subtitleMode ?? defaultPreferences.subtitleMode,
      canSwitchTracks: row.canSwitchTracks ?? defaultPreferences.canSwitchTracks,
      autoplay: row.autoplay ?? defaultPreferences.autoplay,
      hideSpoilers: row.hideSpoilers ?? defaultPreferences.hideSpoilers,
      spoilerMode: row.spoilerMode ?? defaultPreferences.spoilerMode,
      notifyFamilyActivity: row.notifyFamilyActivity ?? defaultPreferences.notifyFamilyActivity,
      notifyReplies: row.notifyReplies ?? defaultPreferences.notifyReplies,
      defaultSavedViewId: row.defaultSavedViewId ?? defaultPreferences.defaultSavedViewId,
      homeLayout: row.homeLayout ?? defaultPreferences.homeLayout,
      dashboardLayout: row.dashboardLayout ?? defaultPreferences.dashboardLayout,
    },
    contentPolicy: classification(row),
    isCurrent: row.id === currentId,
  });
}

async function accountRows(where: "current" | "family", authUserId: string) {
  const sql = database().client;
  return sql`
    select a.id, a.display_name as "displayName", a.kind, a.status,
      a.avatar_key as "avatarKey", a.bio, u.username, u.role,
      coalesce((select array_agg(c.capability order by c.capability)
        from account_capabilities c where c.account_id=a.id), array[]::text[]) as capabilities,
      p.theme, p.preferred_audio as "preferredAudio", p.allowed_audio as "allowedAudio",
      p.subtitle_mode as "subtitleMode", p.can_switch_tracks as "canSwitchTracks",
      p.autoplay, p.hide_spoilers as "hideSpoilers",
      p.notify_family_activity as "notifyFamilyActivity", p.notify_replies as "notifyReplies",
      p.spoiler_mode as "spoilerMode", p.default_saved_view_id as "defaultSavedViewId",
      p.home_layout as "homeLayout", p.dashboard_layout as "dashboardLayout",
      cp.audience, cp.age, cp.sexuality_risk as sexuality,
      cp.behavioral_risk as behavioral, cp.theology_risk as theology
    from accounts a
    join auth_users u on u.id=a.auth_user_id
    left join account_preferences p on p.account_id=a.id
    left join account_content_policies cp on cp.account_id=a.id
    where ${
      where === "current"
        ? sql`a.auth_user_id=${authUserId}`
        : sql`a.status='active' and a.is_discoverable`
    }
    order by a.display_name`;
}

export async function currentFamilyAccount(headers: Headers) {
  const session = await getAuthSession(headers);
  if (!session) return null;
  const [row] = await accountRows("current", session.user.id);
  return row ? { session, account: mapAccount(row, String(row.id)) } : null;
}

export async function createFamilyAccount(input: {
  username: string;
  password: string;
  displayName: string;
  kind: AccountKind;
  role: AccountRole;
  avatarKey: string;
  capabilities: AccountCapability[];
}) {
  const result = await auth.api.signUpEmail({
    body: {
      name: input.displayName,
      email: `${input.username.toLowerCase()}@users.arcadia.invalid`,
      password: input.password,
      username: input.username,
      displayUsername: input.username,
    },
  });
  const authUserId = result.user.id;
  const policy = policies[input.kind];
  try {
    return await database().client.begin(async (sql) => {
      await sql`update auth_users set role=${input.role}, username=${input.username.toLowerCase()},
        display_username=${input.username}, updated_at=now() where id=${authUserId}`;
      const [created] = await sql`insert into accounts
        (auth_user_id, kind, status, slug, display_name, avatar_key)
        values (${authUserId}, ${input.kind}, 'active', ${input.username.toLowerCase()},
          ${input.displayName}, ${input.avatarKey}) returning id`;
      if (!created) throw new Error("تعذّر إنشاء حساب العائلة.");
      await sql`insert into account_preferences (account_id) values (${created.id})`;
      await sql`insert into account_content_policies
        (account_id, audience, age, sexuality_risk, behavioral_risk, theology_risk)
        values (${created.id}, ${policy.audience}, ${policy.age}, ${policy.sexuality},
          ${policy.behavioral}, ${policy.theology})`;
      await sql`insert into account_admin_restrictions
        (account_id, audience, age, sexuality_risk, behavioral_risk, theology_risk)
        values (${created.id}, ${policy.audience}, ${policy.age}, ${policy.sexuality},
          ${policy.behavioral}, ${policy.theology})`;
      for (const capability of input.capabilities) {
        await sql`insert into account_capabilities (account_id, capability)
          values (${created.id}, ${capability}) on conflict do nothing`;
      }
      return String(created.id);
    });
  } catch (error) {
    await database().client`delete from auth_users where id=${authUserId}`;
    throw error;
  }
}

async function isOwner(headers: Headers) {
  if (isTestAuthBypass()) return true;
  const session = await getAuthSession(headers);
  return session?.user.role === "owner";
}

export const accountRoutes = new OpenAPIHono();

accountRoutes.get("/api/v1/me", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير مرتبط بملف عائلي." }, 404);
  return context.json({ account: current.account, expiresAt: current.session.session.expiresAt });
});

accountRoutes.patch("/api/v1/me", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير مرتبط بملف عائلي." }, 404);
  const parsed = updateAccountInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "إعدادات الحساب غير صالحة." }, 400);
  const sql = database().client;
  const input = parsed.data;
  await sql.begin(async (transaction) => {
    await transaction`update accounts set
      display_name=coalesce(${input.displayName ?? null}, display_name),
      avatar_key=coalesce(${input.avatarKey ?? null}, avatar_key),
      bio=coalesce(${input.bio ?? null}, bio), updated_at=now()
      where id=${current.account.id}`;
    if (input.preferences) {
      const preferences = { ...current.account.preferences, ...input.preferences };
      await transaction`insert into account_preferences
        (account_id, theme, preferred_audio, allowed_audio, subtitle_mode, can_switch_tracks,
          autoplay, hide_spoilers, spoiler_mode, notify_family_activity, notify_replies,
          default_saved_view_id, home_layout, dashboard_layout)
        values (${current.account.id}, ${preferences.theme}, ${preferences.preferredAudio},
          ${preferences.allowedAudio}, ${preferences.subtitleMode}, ${preferences.canSwitchTracks},
          ${preferences.autoplay}, ${preferences.hideSpoilers}, ${preferences.spoilerMode},
          ${preferences.notifyFamilyActivity}, ${preferences.notifyReplies},
          ${preferences.defaultSavedViewId}, ${JSON.stringify(preferences.homeLayout)}::jsonb,
          ${JSON.stringify(preferences.dashboardLayout)}::jsonb)
        on conflict (account_id) do update set theme=excluded.theme,
          preferred_audio=excluded.preferred_audio, allowed_audio=excluded.allowed_audio,
          subtitle_mode=excluded.subtitle_mode, can_switch_tracks=excluded.can_switch_tracks,
          autoplay=excluded.autoplay, hide_spoilers=excluded.hide_spoilers,
          spoiler_mode=excluded.spoiler_mode, default_saved_view_id=excluded.default_saved_view_id,
          home_layout=excluded.home_layout, dashboard_layout=excluded.dashboard_layout,
          notify_family_activity=excluded.notify_family_activity,
          notify_replies=excluded.notify_replies`;
    }
    if (input.contentPolicy) {
      const policy = input.contentPolicy;
      await transaction`insert into account_content_policies
        (account_id, audience, age, sexuality_risk, behavioral_risk, theology_risk)
        values (${current.account.id}, ${policy.audience}, ${policy.age}, ${policy.sexuality},
          ${policy.behavioral}, ${policy.theology}) on conflict (account_id) do update set
          audience=excluded.audience, age=excluded.age,
          sexuality_risk=excluded.sexuality_risk, behavioral_risk=excluded.behavioral_risk,
          theology_risk=excluded.theology_risk`;
    }
  });
  const refreshed = await currentFamilyAccount(context.req.raw.headers);
  return context.json(refreshed?.account ?? current.account);
});

accountRoutes.get("/api/v1/family/accounts", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير مرتبط بملف عائلي." }, 404);
  const rows = await accountRows("family", current.session.user.id);
  return context.json(rows.map((row) => mapAccount(row, current.account.id)));
});

accountRoutes.get("/api/v1/admin/accounts", async (context) => {
  if (!(await isOwner(context.req.raw.headers))) {
    return context.json({ message: "إدارة الحسابات متاحة لمالك أركاديا فقط." }, 403);
  }
  const rows = await database().client`
    select a.id, a.display_name as "displayName", a.kind, a.status,
      a.avatar_key as "avatarKey", a.last_seen_at as "lastSeenAt", u.username, u.role,
      coalesce((select array_agg(c.capability order by c.capability)
        from account_capabilities c where c.account_id=a.id), array[]::text[]) as capabilities,
      cp.audience, cp.age, cp.sexuality_risk as sexuality,
      cp.behavioral_risk as behavioral, cp.theology_risk as theology,
      ar.audience as "adminAudience", ar.age as "adminAge",
      ar.sexuality_risk as "adminSexuality", ar.behavioral_risk as "adminBehavioral",
      ar.theology_risk as "adminTheology",
      (select count(*)::int from account_title_blocks b where b.account_id=a.id) as "titleBlockCount",
      (select count(*)::int from account_tag_blocks b where b.account_id=a.id) as "tagBlockCount",
      (select count(*)::int from account_genre_blocks b where b.account_id=a.id) as "genreBlockCount",
      (select count(*)::int from account_entity_blocks b where b.account_id=a.id) as "entityBlockCount",
      (select count(*)::int from account_planet_blocks b where b.account_id=a.id) as "planetBlockCount"
    from accounts a join auth_users u on u.id=a.auth_user_id
    left join account_content_policies cp on cp.account_id=a.id
    left join account_admin_restrictions ar on ar.account_id=a.id
    order by a.display_name`;
  return context.json(
    rows.map((row) =>
      accountPolicyPreviewSchema.parse({
        ...row,
        role: asRole(row.role),
        capabilities: row.capabilities ?? [],
        contentPolicy: classification(row),
        adminRestrictions: classification(row, "admin"),
        lastSeenAt: dateString(row.lastSeenAt),
        authenticationReady: true,
      }),
    ),
  );
});

accountRoutes.post("/api/v1/admin/accounts", async (context) => {
  if (!(await isOwner(context.req.raw.headers))) {
    return context.json({ message: "إدارة الحسابات متاحة لمالك أركاديا فقط." }, 403);
  }
  const parsed = createAccountInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات الحساب غير صالحة." }, 400);
  try {
    const id = await createFamilyAccount(parsed.data);
    return context.json({ id }, 201);
  } catch (error) {
    return context.json(
      { message: error instanceof Error ? error.message : "تعذّر إنشاء الحساب." },
      400,
    );
  }
});

accountRoutes.patch("/api/v1/admin/accounts/:accountId", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (current?.session.user.role !== "owner") {
    return context.json({ message: "إدارة الحسابات متاحة لمالك أركاديا فقط." }, 403);
  }
  const parsed = adminUpdateAccountInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "تعديلات الحساب غير صالحة." }, 400);
  const accountId = context.req.param("accountId");
  if (
    accountId === current.account.id &&
    (parsed.data.role === "editor" ||
      parsed.data.role === "member" ||
      parsed.data.status === "suspended")
  ) {
    return context.json({ message: "لا يمكن للمالك سحب صلاحية حسابه الحالي." }, 400);
  }
  const [target] = await database().client`
    select a.auth_user_id, a.display_name, a.kind, a.status, a.avatar_key, u.role
    from accounts a join auth_users u on u.id=a.auth_user_id where a.id=${accountId}`;
  if (!target) return context.json({ message: "الحساب غير موجود." }, 404);
  const input = parsed.data;
  await database().client.begin(async (sql) => {
    await sql`update accounts set
      display_name=${input.displayName ?? target.display_name},
      kind=${input.kind ?? target.kind}, status=${input.status ?? target.status},
      avatar_key=${input.avatarKey ?? target.avatar_key}, updated_at=now()
      where id=${accountId}`;
    if (input.role) {
      await sql`update auth_users set role=${input.role}, updated_at=now()
        where id=${target.auth_user_id}`;
    }
    if (input.capabilities) {
      await sql`delete from account_capabilities where account_id=${accountId}`;
      for (const capability of input.capabilities) {
        await sql`insert into account_capabilities (account_id, capability)
          values (${accountId}, ${capability})`;
      }
    }
    if (input.contentPolicy) {
      const policy = input.contentPolicy;
      await sql`insert into account_content_policies
        (account_id, audience, age, sexuality_risk, behavioral_risk, theology_risk)
        values (${accountId}, ${policy.audience}, ${policy.age}, ${policy.sexuality},
          ${policy.behavioral}, ${policy.theology}) on conflict (account_id) do update set
          audience=excluded.audience, age=excluded.age,
          sexuality_risk=excluded.sexuality_risk, behavioral_risk=excluded.behavioral_risk,
          theology_risk=excluded.theology_risk`;
    }
    if (input.adminRestrictions) {
      const policy = input.adminRestrictions;
      await sql`insert into account_admin_restrictions
        (account_id, audience, age, sexuality_risk, behavioral_risk, theology_risk)
        values (${accountId}, ${policy.audience}, ${policy.age}, ${policy.sexuality},
          ${policy.behavioral}, ${policy.theology}) on conflict (account_id) do update set
          audience=excluded.audience, age=excluded.age,
          sexuality_risk=excluded.sexuality_risk, behavioral_risk=excluded.behavioral_risk,
          theology_risk=excluded.theology_risk`;
    }
    if (input.blockedTitleIds) {
      await sql`delete from account_title_blocks where account_id=${accountId}`;
      for (const id of input.blockedTitleIds)
        await sql`insert into account_title_blocks (account_id, title_id)
          values (${accountId}, ${id})`;
    }
    if (input.blockedTagIds) {
      await sql`delete from account_tag_blocks where account_id=${accountId}`;
      for (const id of input.blockedTagIds)
        await sql`insert into account_tag_blocks (account_id, tag_id) values (${accountId}, ${id})`;
    }
    if (input.blockedGenreIds) {
      await sql`delete from account_genre_blocks where account_id=${accountId}`;
      for (const id of input.blockedGenreIds)
        await sql`insert into account_genre_blocks (account_id, genre_id)
          values (${accountId}, ${id})`;
    }
    if (input.blockedEntityIds) {
      await sql`delete from account_entity_blocks where account_id=${accountId}`;
      for (const id of input.blockedEntityIds)
        await sql`insert into account_entity_blocks (account_id, entity_id)
          values (${accountId}, ${id})`;
    }
    if (input.blockedPlanetIds) {
      await sql`delete from account_planet_blocks where account_id=${accountId}`;
      for (const id of input.blockedPlanetIds)
        await sql`insert into account_planet_blocks (account_id, planet_id)
          values (${accountId}, ${id})`;
    }
  });
  return context.json({ updated: true });
});

accountRoutes.get("/api/v1/admin/accounts/:accountId/restrictions", async (context) => {
  if (!(await isOwner(context.req.raw.headers))) {
    return context.json({ message: "إدارة القيود متاحة لمالك أركاديا فقط." }, 403);
  }
  const accountId = context.req.param("accountId");
  const sql = database().client;
  const [accountRow] = await sql`select id from accounts where id=${accountId}`;
  if (!accountRow) return context.json({ message: "الحساب غير موجود." }, 404);
  const [
    blockedTitles,
    blockedTags,
    blockedGenres,
    blockedEntities,
    blockedPlanets,
    titles,
    tags,
    genres,
    entities,
    planets,
  ] = await Promise.all([
    sql`select title_id as id from account_title_blocks where account_id=${accountId}`,
    sql`select tag_id as id from account_tag_blocks where account_id=${accountId}`,
    sql`select genre_id as id from account_genre_blocks where account_id=${accountId}`,
    sql`select entity_id as id from account_entity_blocks where account_id=${accountId}`,
    sql`select planet_id as id from account_planet_blocks where account_id=${accountId}`,
    sql`select id, coalesce(title_ar, canonical_title) as label,
        canonical_title as description, 'title' as kind from titles order by sort_title`,
    sql`select id, label_ar as label, label_en as description, 'tag' as kind
        from tags where is_active order by position, label_ar`,
    sql`select id, label_ar as label, label_en as description, 'genre' as kind
        from genres where is_active order by position, label_ar`,
    sql`select id, name as label, sort_name as description, kind::text
        from entities order by sort_name`,
    sql`select id, name_ar as label, name_en as description, 'planet' as kind
        from planets where is_active order by display_order`,
  ]);
  const idList = (rows: AccountRow[]) => rows.map((row) => String(row.id));
  return context.json(
    accountRestrictionEditorSchema.parse({
      blockedTitleIds: idList(blockedTitles),
      blockedTagIds: idList(blockedTags),
      blockedGenreIds: idList(blockedGenres),
      blockedEntityIds: idList(blockedEntities),
      blockedPlanetIds: idList(blockedPlanets),
      options: { titles, tags, genres, entities, planets },
    }),
  );
});

accountRoutes.post("/api/v1/admin/invites", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (current?.session.user.role !== "owner") {
    return context.json({ message: "إنشاء الدعوات متاح لمالك أركاديا فقط." }, 403);
  }
  const parsed = createInviteInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات الدعوة غير صالحة." }, 400);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);
  const [invite] = await database().client`insert into account_invites
    (token_hash, display_name, username, kind, role, avatar_key, capabilities,
      created_by_account_id, expires_at)
    values (${tokenHash}, ${parsed.data.displayName}, ${parsed.data.username.toLowerCase()},
      ${parsed.data.kind}, ${parsed.data.role}, ${parsed.data.avatarKey},
      ${parsed.data.capabilities}, ${current.account.id}, ${expiresAt.toISOString()}) returning id`;
  const webUrl = process.env.ARCADIA_WEB_URL ?? "http://127.0.0.1:3000";
  return context.json(
    { id: String(invite?.id), token, inviteUrl: `${webUrl}/invite/${token}`, expiresAt },
    201,
  );
});

accountRoutes.post("/api/v1/invites/accept", async (context) => {
  const parsed = acceptInviteInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "رابط الدعوة أو كلمة المرور غير صالح." }, 400);
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const [invite] = await database().client`
    select * from account_invites where token_hash=${tokenHash} and accepted_at is null
      and expires_at > now() limit 1`;
  if (!invite) return context.json({ message: "انتهت صلاحية الدعوة أو استُخدمت سابقاً." }, 404);
  try {
    const accountId = await createFamilyAccount({
      username: String(invite.username),
      password: parsed.data.password,
      displayName: String(invite.display_name),
      kind: invite.kind as AccountKind,
      role: asRole(invite.role),
      avatarKey: String(invite.avatar_key),
      capabilities: (invite.capabilities ?? []) as AccountCapability[],
    });
    await database().client`update account_invites set accepted_by_account_id=${accountId},
      accepted_at=now() where id=${invite.id} and accepted_at is null`;
    return context.json({ accepted: true, accountId, username: String(invite.username) }, 201);
  } catch (error) {
    return context.json(
      { message: error instanceof Error ? error.message : "تعذّر تفعيل الحساب." },
      400,
    );
  }
});

export const accountDefaults = { preferences: defaultPreferences, policies } as const;
