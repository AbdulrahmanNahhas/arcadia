import { describe, expect, it } from "vitest";

import { localApiBase, verifyDashboardOrigin } from "./auth-policy";

describe("dashboard authentication boundaries", () => {
  it("allows same-origin mutations and originless reads", () => {
    expect(() =>
      verifyDashboardOrigin(
        new Request("http://127.0.0.1:23100/_serverFn/login", {
          method: "POST",
          headers: { origin: "http://127.0.0.1:23100", "sec-fetch-site": "same-origin" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      verifyDashboardOrigin(new Request("http://127.0.0.1:23100/_serverFn/session")),
    ).not.toThrow();
  });
  it("rejects cross-origin, cross-site and originless mutations", () => {
    for (const headers of [
      new Headers({ origin: "https://attacker.invalid" }),
      new Headers({ origin: "http://127.0.0.1:23100", "sec-fetch-site": "cross-site" }),
      new Headers(),
    ]) {
      expect(() =>
        verifyDashboardOrigin(
          new Request("http://127.0.0.1:23100/_serverFn/login", { method: "POST", headers }),
        ),
      ).toThrow("الطلب من مصدر غير مسموح");
    }
  });
  it("keeps private bridge credentials on loopback API addresses", () => {
    expect(localApiBase("http://127.0.0.1:23103")).toBe("http://127.0.0.1:23103");
    for (const address of [
      "https://remote.invalid",
      "file:///tmp/server",
      "http://127.0.0.1:23103/path",
      "http://token@localhost:23103",
      "http://localhost:23103?redirect=1",
    ])
      expect(() => localApiBase(address)).toThrow("عنوان الخادم المحلي غير صالح");
  });
});
