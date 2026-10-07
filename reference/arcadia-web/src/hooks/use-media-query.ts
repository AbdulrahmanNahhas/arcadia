import * as React from "react";

function matchesQuery(query: string) {
  return import.meta.env.SSR ? false : matchMedia(query).matches;
}

export function useMediaQuery(query: string) {
  const [trackedQuery, setTrackedQuery] = React.useState(query);
  const [value, setValue] = React.useState(() => matchesQuery(query));

  if (query !== trackedQuery) {
    setTrackedQuery(query);
    setValue(matchesQuery(query));
  }

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}
