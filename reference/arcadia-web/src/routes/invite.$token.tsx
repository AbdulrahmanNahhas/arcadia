import { createFileRoute } from "@tanstack/react-router";
import { InvitePage } from "@/features/accounts/invite-page";

export const Route = createFileRoute("/invite/$token")({ component: InviteRoute });

function InviteRoute() {
  const { token } = Route.useParams();
  return <InvitePage token={token} />;
}
