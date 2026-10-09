import type { User } from "@nahhasio/api-contract";

import { ViewerShell } from "../shell/viewer-shell";
export function Library({ user }: { user: User }) {
  return <ViewerShell user={user} />;
}
