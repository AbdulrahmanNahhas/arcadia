import { createDatabase } from "@arcadia/database";

let connection: ReturnType<typeof createDatabase> | undefined;
export function database() {
  if (!connection) connection = createDatabase();
  return connection;
}
export async function databaseReady() {
  try {
    await database().client`select 1`;
    return true;
  } catch {
    return false;
  }
}
