import "./env";
import { serve } from "@hono/node-server";
import { app } from "./app";

if (process.env.NODE_ENV === "production" && process.env.ARCADIA_MOCK_AUTH === "true")
  throw new Error("Refusing production startup while ARCADIA_MOCK_AUTH=true");
const port = Number(process.env.PORT ?? 3001);
// Loopback-only by default — matches devenv's setup, where nothing outside the dev machine
// should reach the API directly. A container needs 0.0.0.0 (127.0.0.1 inside a container accepts
// no connections from outside its own network namespace, so port-mapping alone would never work);
// set HOST explicitly rather than flipping the default, so bare `node dist/server.js` outside
// Docker stays loopback-only unless someone opts in on purpose.
const hostname = process.env.HOST ?? "127.0.0.1";
serve({ fetch: app.fetch, hostname, port }, (info) =>
  console.log(`Arcadia API listening on http://${info.address}:${info.port}`),
);
