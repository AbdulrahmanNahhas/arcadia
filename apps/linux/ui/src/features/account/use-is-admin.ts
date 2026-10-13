import { useQuery } from "@tanstack/react-query";

import { gateway } from "@/lib/bridge";

/** Presentation follows the shared session; server guards authorize every operation. */
export function useIsAdmin() {
  return (
    useQuery({
      queryKey: ["session"],
      queryFn: ({ signal }) => gateway.session(signal),
      select: (session) => session?.user.isAdmin === true,
    }).data === true
  );
}
