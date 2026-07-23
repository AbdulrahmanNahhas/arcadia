import { createFileRoute } from "@tanstack/react-router"
import { ActivityFeedPage } from "@/features/activity/activity-feed-page"

export const Route = createFileRoute("/feed")({
  component: ActivityFeedPage,
})
