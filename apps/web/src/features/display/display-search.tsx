import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { FocusContext } from "@/features/platform/spatial-navigation";
import { searchQueryOptions } from "./api";
import { cardItemFromTitle, DisplayCard } from "./display-card";
import { DisplayShell } from "./display-shell";
import { OnScreenKeyboard } from "./on-screen-keyboard";

/**
 * Display Search: keyboard on one side, live results on the other, as you type — there is no
 * submit on a remote. A physical keyboard types straight into the same field.
 */
export function DisplaySearch() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const results = useQuery(searchQueryOptions(deferred));
  const items = useMemo(() => (results.data ?? []).map(cardItemFromTitle), [results.data]);

  return (
    <DisplayShell>
      <div className="grid grid-cols-[minmax(0,32rem)_1fr] gap-10 px-[5vw] pb-24">
        <div className="flex flex-col gap-6">
          <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-2xl">
            <MagnifyingGlassIcon className="shrink-0 text-white/60" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن عمل…"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/40"
              aria-label="بحث"
            />
          </label>
          <OnScreenKeyboard value={query} onChange={setQuery} />
        </div>
        <FocusContext.Provider value="search-results">
          <div className="min-w-0">
            {deferred ? (
              <p className="mb-4 text-lg text-white/60">
                {results.isPending ? "جارٍ البحث…" : `${items.length} نتيجة لـ «${deferred}»`}
              </p>
            ) : (
              <p className="mb-4 text-lg text-white/60">اكتب اسم عمل بالعربية أو بالإنجليزية.</p>
            )}
            <div
              data-display-rail
              className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-7"
            >
              {items.map((item, index) => (
                <DisplayCard key={item.id} item={item} focusKey={`search:${index}`} />
              ))}
            </div>
          </div>
        </FocusContext.Provider>
      </div>
    </DisplayShell>
  );
}
