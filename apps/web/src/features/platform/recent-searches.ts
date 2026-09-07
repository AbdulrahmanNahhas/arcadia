const RECENT_SEARCH_LIMIT = 8;

type SearchStorage = Pick<Storage, "getItem" | "setItem">;

function key(accountId: string) {
  return `arcadia:recent-searches:${accountId}`;
}

function normalized(term: string) {
  return term.trim().replace(/\s+/g, " ");
}

export function readRecentSearches(accountId: string, storage: SearchStorage): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key(accountId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is string => typeof item === "string" && normalized(item) !== "",
    );
  } catch {
    return [];
  }
}

export function rememberRecentSearch(
  accountId: string,
  term: string,
  storage: SearchStorage,
): string[] {
  const nextTerm = normalized(term);
  if (!nextTerm) return readRecentSearches(accountId, storage);
  const searches = [
    nextTerm,
    ...readRecentSearches(accountId, storage).filter(
      (item) => item.toLocaleLowerCase() !== nextTerm.toLocaleLowerCase(),
    ),
  ].slice(0, RECENT_SEARCH_LIMIT);
  storage.setItem(key(accountId), JSON.stringify(searches));
  return searches;
}

export function removeRecentSearch(
  accountId: string,
  term: string,
  storage: SearchStorage,
): string[] {
  const searches = readRecentSearches(accountId, storage).filter((item) => item !== term);
  storage.setItem(key(accountId), JSON.stringify(searches));
  return searches;
}

export function clearRecentSearches(accountId: string, storage: SearchStorage) {
  storage.setItem(key(accountId), "[]");
}
