import { expect, it } from "vitest";
import { t, taxonomyLabel } from ".";

it("keeps Arabic interface and taxonomy labels centralized", () => {
  expect(t("ar", "browse")).toBe("تصفّح");
  expect(taxonomyLabel("ar", "genres", "science-fiction")).toBe("خيال علمي");
});
