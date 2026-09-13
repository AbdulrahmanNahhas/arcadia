import { describe, expect, it } from "vitest";
import { resolveTheme, themeRestoreScript } from "./theme";

describe("resolveTheme", () => {
  it("returns explicit preferences unchanged regardless of the OS", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("follows the OS for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

// The inline script cannot import resolveTheme, so this pins the two to the same behaviour.
function runRestoreScript(stored: string | null, prefersDark: boolean) {
  let dark = false;
  const root = {
    classList: {
      toggle(_name: string, force: boolean) {
        dark = force;
      },
    },
    style: { colorScheme: "", backgroundColor: "" },
  };
  const script = new Function("document", "localStorage", "matchMedia", themeRestoreScript);
  script({ documentElement: root }, { getItem: () => stored }, () => ({ matches: prefersDark }));
  return {
    theme: dark ? "dark" : "light",
    colorScheme: root.style.colorScheme,
    backgroundColor: root.style.backgroundColor,
  };
}

describe("themeRestoreScript", () => {
  it("mirrors resolveTheme for every stored value", () => {
    const dark = { theme: "dark", colorScheme: "dark", backgroundColor: "#080c13" };
    const light = { theme: "light", colorScheme: "light", backgroundColor: "#f4f7fb" };
    expect(runRestoreScript(null, false)).toEqual(dark);
    expect(runRestoreScript("light", true)).toEqual(light);
    expect(runRestoreScript("system", true)).toEqual(dark);
    expect(runRestoreScript("system", false)).toEqual(light);
    expect(runRestoreScript("garbage", true)).toEqual(light);
  });
});
