import { describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";

async function signIn(username: string, password: string) {
  const response = await app.request("/api/auth/sign-in/username", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const token = response.headers.get("set-auth-token");
  if (!token) throw new Error("Expected Better Auth to return a bearer token");
  return token;
}

async function signOut(token: string) {
  await app.request("/api/auth/sign-out", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("account content-restriction visibility", () => {
  it("reports contentRestricted only once the family ceiling actually narrows the account", async () => {
    const token = await signIn("personal", "ArcadiaPersonal!2026");
    const sql = database().client;
    try {
      const initial = await app.request("/api/v1/me", {
        headers: { authorization: `Bearer ${token}` },
      });
      const initialBody = (await initial.json()) as {
        account: { id: string };
        contentRestricted: boolean;
      };
      expect(typeof initialBody.contentRestricted).toBe("boolean");
      const accountId = initialBody.account.id;

      const [ownBefore] = await sql`select audience, age, sexuality_risk as "sexualityRisk",
        behavioral_risk as "behavioralRisk", theology_risk as "theologyRisk"
        from account_content_policies where account_id=${accountId}`;
      const [restrictionBefore] = await sql`select audience, age,
        sexuality_risk as "sexualityRisk", behavioral_risk as "behavioralRisk",
        theology_risk as "theologyRisk"
        from account_admin_restrictions where account_id=${accountId}`;

      try {
        // A permissive personal choice under a strict family ceiling: this must always disagree
        // with the ceiling on at least one dimension, so `contentRestricted` has to flip to true.
        await sql`update account_content_policies set audience='adult', age='18+',
          sexuality_risk='high', behavioral_risk='high', theology_risk='high'
          where account_id=${accountId}`;
        await sql`update account_admin_restrictions set audience='general', age='all',
          sexuality_risk='none', behavioral_risk='none', theology_risk='none'
          where account_id=${accountId}`;

        const restricted = await app.request("/api/v1/me", {
          headers: { authorization: `Bearer ${token}` },
        });
        const restrictedBody = (await restricted.json()) as { contentRestricted: boolean };
        expect(restrictedBody.contentRestricted).toBe(true);
      } finally {
        if (ownBefore) {
          await sql`update account_content_policies set audience=${ownBefore.audience},
            age=${ownBefore.age}, sexuality_risk=${ownBefore.sexualityRisk},
            behavioral_risk=${ownBefore.behavioralRisk}, theology_risk=${ownBefore.theologyRisk}
            where account_id=${accountId}`;
        }
        if (restrictionBefore) {
          await sql`update account_admin_restrictions set audience=${restrictionBefore.audience},
            age=${restrictionBefore.age}, sexuality_risk=${restrictionBefore.sexualityRisk},
            behavioral_risk=${restrictionBefore.behavioralRisk},
            theology_risk=${restrictionBefore.theologyRisk} where account_id=${accountId}`;
        }
      }
    } finally {
      await signOut(token);
    }
  });
});
