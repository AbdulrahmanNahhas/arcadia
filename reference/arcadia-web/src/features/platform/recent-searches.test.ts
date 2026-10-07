import { describe, expect, it } from "vitest";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberRecentSearch,
  removeRecentSearch,
} from "./recent-searches";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("recent searches", () => {
  it("normalizes, de-duplicates, and isolates searches by profile", () => {
    const storage = memoryStorage();
    rememberRecentSearch("a", "  Star   Wars ", storage);
    rememberRecentSearch("a", "star wars", storage);
    rememberRecentSearch("b", "Dune", storage);

    expect(readRecentSearches("a", storage)).toEqual(["star wars"]);
    expect(readRecentSearches("b", storage)).toEqual(["Dune"]);
  });

  it("removes one search or clears the profile history", () => {
    const storage = memoryStorage();
    rememberRecentSearch("a", "one", storage);
    rememberRecentSearch("a", "two", storage);

    expect(removeRecentSearch("a", "one", storage)).toEqual(["two"]);
    clearRecentSearches("a", storage);
    expect(readRecentSearches("a", storage)).toEqual([]);
  });
});
