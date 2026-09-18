import { type AccountDownload, upsertDownloadInputSchema } from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { database } from "../../database";
import { currentFamilyAccount } from "../accounts/routes";

/**
 * `/api/v1/me/downloads` — the server-side mirror of each device's download registry
 * (`account_downloads` in schema.ts). The desktop app writes here best-effort after its own
 * registry changes; nothing about playback depends on these rows, they exist so another device
 * or the admin can see what is kept where. Plain session routes like `/me/library`, not part of
 * the OpenAPI document.
 */
export const downloadRoutes = new OpenAPIHono();

type DownloadRow = {
  id: string;
  installmentId: string;
  episodeId: string | null;
  deviceId: string;
  deviceName: string;
  sizeBytes: number | string;
  path: string;
  state: AccountDownload["state"];
  updatedAt: string | Date;
};

function mapRow(row: DownloadRow): AccountDownload {
  return {
    id: row.id,
    installmentId: row.installmentId,
    episodeId: row.episodeId,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    path: row.path,
    sizeBytes: Number(row.sizeBytes),
    state: row.state,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

const selectColumns = () => database().client`id, installment_id as "installmentId",
  episode_id as "episodeId", device_id as "deviceId", device_name as "deviceName", path,
  size_bytes as "sizeBytes", state, updated_at as "updatedAt"`;

downloadRoutes.get("/api/v1/me/downloads", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client<DownloadRow[]>`
    select ${selectColumns()} from account_downloads
    where account_id=${current.account.id}
    order by updated_at desc`;
  return context.json(rows.map(mapRow));
});

/** Upsert keyed by (account, device, installment, episode): the same unit from the same device
 *  updates in place, so progress/state changes never accumulate rows. */
downloadRoutes.put("/api/v1/me/downloads", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = upsertDownloadInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات التنزيل غير صالحة." }, 400);
  const input = parsed.data;
  const [row] = await database().client<DownloadRow[]>`
    insert into account_downloads
      (account_id, installment_id, episode_id, device_id, device_name, path, size_bytes, state)
    values (${current.account.id}, ${input.installmentId}, ${input.episodeId}, ${input.deviceId},
      ${input.deviceName}, ${input.path}, ${input.sizeBytes}, ${input.state})
    on conflict (account_id, device_id, installment_id,
      coalesce(episode_id, '00000000-0000-0000-0000-000000000000'::uuid))
    do update set device_name=excluded.device_name, path=excluded.path,
      size_bytes=excluded.size_bytes, state=excluded.state, updated_at=now()
    returning ${selectColumns()}`;
  if (!row) return context.json({ message: "تعذّر حفظ التنزيل." }, 500);
  return context.json(mapRow(row));
});

downloadRoutes.delete("/api/v1/me/downloads/:id", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const id = context.req.param("id");
  await database().client`
    delete from account_downloads where id=${id} and account_id=${current.account.id}`;
  return context.body(null, 204);
});
