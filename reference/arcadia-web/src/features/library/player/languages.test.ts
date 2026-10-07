import { describe, expect, it } from "vitest";
import { languageInfo } from "./languages";

describe("languageInfo", () => {
  it("folds ISO 639-2 aliases onto the canonical entry", () => {
    expect(languageInfo("eng")).toEqual(languageInfo("en"));
    expect(languageInfo("ARA").code).toBe("ar");
    expect(languageInfo("fre").code).toBe("fr");
    expect(languageInfo("deu").code).toBe("de");
  });

  it("keeps the Brazilian Portuguese variant apart, but falls back on the base tag otherwise", () => {
    expect(languageInfo("pt-BR").code).toBe("pt-br");
    expect(languageInfo("pob").code).toBe("pt-br");
    expect(languageInfo("en-US").code).toBe("en");
    expect(languageInfo("zh-Hans").code).toBe("zh");
  });

  it("labels a missing or undetermined tag honestly", () => {
    expect(languageInfo(null).code).toBe("und");
    expect(languageInfo("und").label).toBe("غير محدد");
    expect(languageInfo("").code).toBe("und");
  });

  it("shows an unknown-but-real code rather than dropping it", () => {
    const info = languageInfo("xx");
    expect(info.code).toBe("xx");
    expect(info.label).toBe("XX");
  });
});
