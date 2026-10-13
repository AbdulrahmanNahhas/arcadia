/** Explicit local development provisioning. Never run from startup or in a deployed server. */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import postgres from "postgres";

const address = new URL(process.env.DATABASE_URL ?? "");
const password = process.env.NAHHASIO_LOCAL_ACCOUNT_PASSWORD;
if (
  process.env.NAHHASIO_PROVISION_LOCAL_ACCOUNTS !== "1" ||
  process.env.NODE_ENV === "production" ||
  !["127.0.0.1", "localhost"].includes(address.hostname) ||
  (address.pathname !== "/arcadia" &&
    !/^\/nahhasio_accounts_[a-f0-9]+_test$/.test(address.pathname)) ||
  !password ||
  password.length < 6
) {
  throw new Error("Explicit local arcadia provisioning and a development password are required");
}
const options = { N: 16384, r: 16, p: 1, maxmem: 128 * 1024 * 1024 };
const makeHash = () => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password.normalize("NFKC"), salt, 64, options).toString("hex")}`;
};
const matches = (hash: string | null) => {
  if (!hash) return false;
  const [salt, key] = hash.split(":");
  if (!salt || !key || !/^[a-f\d]{32}$/i.test(salt) || !/^[a-f\d]{128}$/i.test(key)) return false;
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    scryptSync(password.normalize("NFKC"), salt, 64, options),
  );
};
const sql = postgres(address.toString(), { max: 1 });
try {
  await sql.begin(async (tx) => {
    for (const entry of [
      {
        email: "admin@nahhasio.local",
        name: "المدير",
        role: "owner",
        kind: "admin",
        slug: "nahhasio-local-admin",
        avatar: "nahhasio-library.svg",
      },
      {
        email: "user@nahhasio.local",
        name: "المستخدم",
        role: "member",
        kind: "personal",
        slug: "nahhasio-local-user",
        avatar: "nahhasio-orbit.svg",
      },
    ]) {
      const existing = await tx<
        { id: string }[]
      >`select id from auth_users where lower(email)=lower(${entry.email}) for update`;
      const userId = existing[0]?.id ?? crypto.randomUUID();
      await tx`insert into auth_users (id,name,email,email_verified,role,image) values (${userId},${entry.name},${entry.email},true,${entry.role},${entry.avatar}) on conflict(id) do update set name=excluded.name,role=excluded.role,image=excluded.image,banned=false,ban_reason=null,ban_expires=null,updated_at=now()`;
      const credentials = await tx<
        { password: string | null }[]
      >`select password from auth_accounts where user_id=${userId} and provider_id='credential'`;
      if (!matches(credentials[0]?.password ?? null)) {
        const hashed = makeHash();
        if (credentials.length)
          await tx`update auth_accounts set password=${hashed},updated_at=now() where user_id=${userId} and provider_id='credential'`;
        else
          await tx`insert into auth_accounts(id,account_id,provider_id,user_id,password) values (${crypto.randomUUID()},${userId},'credential',${userId},${hashed})`;
        await tx`delete from auth_sessions where user_id=${userId}`;
      }
      const profiles = await tx<
        { id: string }[]
      >`insert into accounts(auth_user_id,kind,status,slug,display_name,avatar_key,is_discoverable) values(${userId},${entry.kind},'active',${entry.slug},${entry.name},${entry.avatar},false) on conflict(auth_user_id) do update set kind=excluded.kind,status='active',display_name=excluded.display_name,avatar_key=excluded.avatar_key,updated_at=now() returning id`;
      const accountId = profiles[0]!.id;
      await tx`insert into account_content_policies(account_id,audience,age,sexuality_risk,behavioral_risk,theology_risk) values(${accountId},'adult','18+','high','high','high') on conflict(account_id) do nothing`;
      const capabilities =
        entry.kind === "admin"
          ? [
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
            ]
          : ["catalog.view"];
      for (const capability of capabilities)
        await tx`insert into account_capabilities(account_id,capability) values(${accountId},${capability}) on conflict do nothing`;
    }
    // Retire only the known synthetic seeds. Their IDs/history/relationships remain intact.
    if (process.env.NAHHASIO_RETIRE_DEMO_ACCOUNTS === "1") {
      const demoIds = ["arcadia-demo-owner", "arcadia-demo-family", "arcadia-demo-personal"];
      await tx`update accounts set status='suspended',updated_at=now() where auth_user_id in ${tx(demoIds)}`;
      await tx`update auth_users set banned=true,ban_expires=null,ban_reason='Retired local development seed',updated_at=now() where id in ${tx(demoIds)} and email like '%@users.arcadia.invalid'`;
      await tx`delete from auth_sessions where user_id in ${tx(demoIds)}`;
    }
  });
  console.log("Provisioned the two local accounts; preserved catalog and account ownership.");
} finally {
  await sql.end();
}
