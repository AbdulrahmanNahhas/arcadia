import { describe, expect, it } from "vitest";
import { z } from "zod";
import { app } from "../../app";
import { database } from "../../database";
import { catalogIsPopulated } from "../../test-support";

const meResponseSchema = z.object({
  account: z.object({ id: z.string() }),
  contentRestricted: z.boolean(),
});
const titlesBrowseResponseSchema = z.object({ total: z.number() });

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
      const initialBody = meResponseSchema.parse(await initial.json());
      expect(initialBody.contentRestricted).toBeTypeOf("boolean");
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
        const restrictedBody = meResponseSchema.parse(await restricted.json());
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

const hasCatalog = await catalogIsPopulated();

describe("account visible-title-kinds preference", () => {
  it.skipIf(!hasCatalog)(
    "hides every title of a type the account turned off, and shows them again once re-enabled",
    async () => {
      const token = await signIn("personal", "ArcadiaPersonal!2026");
      const sql = database().client;
      try {
        const me = await app.request("/api/v1/me", {
          headers: { authorization: `Bearer ${token}` },
        });
        const { account } = meResponseSchema.parse(await me.json());
        const [before] = await sql`select visible_title_kinds as "visibleTitleKinds"
        from account_preferences where account_id=${account.id}`;

        try {
          // The seed catalog is entirely animated (see the arcadia-cataloging skill), so narrowing
          // to the two live-action types must empty browse entirely — a clean, catalog-independent
          // assertion that the preference is actually enforced server-side, not just stored.
          await sql`update account_preferences
          set visible_title_kinds=array['live-action-movie','live-action-series']
          where account_id=${account.id}`;
          const narrowed = await app.request("/api/v1/titles?limit=5", {
            headers: { authorization: `Bearer ${token}` },
          });
          const narrowedBody = titlesBrowseResponseSchema.parse(await narrowed.json());
          expect(narrowedBody.total).toBe(0);

          await sql`update account_preferences
          set visible_title_kinds=array['animated-movie','animated-series','live-action-movie','live-action-series']
          where account_id=${account.id}`;
          const restored = await app.request("/api/v1/titles?limit=5", {
            headers: { authorization: `Bearer ${token}` },
          });
          const restoredBody = titlesBrowseResponseSchema.parse(await restored.json());
          expect(restoredBody.total).toBeGreaterThan(0);
        } finally {
          if (before) {
            await sql`update account_preferences
            set visible_title_kinds=${before.visibleTitleKinds}
            where account_id=${account.id}`;
          }
        }
      } finally {
        await signOut(token);
      }
    },
  );
});
