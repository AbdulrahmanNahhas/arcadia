import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { Login } from "../features/auth/login";
import { Library } from "../features/library/library";
import { gateway } from "../lib/bridge";
export function App() {
  const client = useQueryClient();
  useEffect(() => {
    const clear = () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      client.setQueryData(["session"], null);
    };
    window.addEventListener("nahhasio:signed-out", clear);
    return () => window.removeEventListener("nahhasio:signed-out", clear);
  }, [client]);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
  if (session.isLoading)
    return (
      <main className="startup" aria-busy="true">
        جارٍ فتح المكتبة…
      </main>
    );
  if (!session.data) return <Login />;
  return <Library user={session.data.user} />;
}
