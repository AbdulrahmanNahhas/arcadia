// Use the upstream CLI's ESM entry: its CommonJS launcher causes a circular
// dependency warning on Node 26. The CLI reads the unchanged command arguments.
await import("@tanstack/router-cli");
