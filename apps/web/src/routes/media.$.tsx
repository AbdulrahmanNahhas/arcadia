import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { mediaResponse } = await import("@/features/artwork/library/media.server");
        return mediaResponse(params["_splat"] ?? "");
      },
    },
  },
});
