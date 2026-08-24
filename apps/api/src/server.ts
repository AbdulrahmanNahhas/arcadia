import "./env";
import { serve } from "@hono/node-server";
import { app } from "./app";

if (process.env.NODE_ENV === "production" && process.env.ARCADIA_MOCK_AUTH === "true")
  throw new Error("Refusing production startup while ARCADIA_MOCK_AUTH=true");
const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) =>
  console.log(`Arcadia API listening on http://${info.address}:${info.port}`),
);
