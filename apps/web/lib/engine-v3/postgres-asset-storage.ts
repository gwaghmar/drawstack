import postgres from "postgres";
import type { AssetStorage, StoredAsset } from "./asset-storage.ts";
import { ingestAsset } from "./asset-ingestion.ts";
import { sha256Hex } from "./components.ts";

const globalClient = globalThis as typeof globalThis & { __engineV3AssetSql?: ReturnType<typeof postgres> };

export function createPostgresAssetStorage(connectionString = process.env.DATABASE_URL): AssetStorage {
  if (!connectionString) return {
    status: { available: false, mode: "unavailable", reason: "Database asset storage is not configured" },
    async put() { throw new Error("Asset storage unavailable: configure DATABASE_URL"); },
    async list() { return []; }, async get() { return null; }, async delete() { return false; },
  };
  const sql = globalClient.__engineV3AssetSql ??= postgres(connectionString, { max: 2, prepare: false });
  return {
    status: { available: true, mode: "external" },
    async put(input, ownerId) {
      const result = await ingestAsset(input);
      const ownerKey = await sha256Hex(ownerId);
      const asset: StoredAsset = { ...result.asset, source: `/api/engine-v3/assets?sha256=${result.asset.sha256}`, ownerId, byteLength: result.content.byteLength, createdAt: new Date().toISOString() };
      const inserted = await sql<{ metadata: StoredAsset }[]>`
        insert into engine_v3_asset (owner_key, sha256, metadata, content)
        values (${ownerKey}, ${asset.sha256}, ${sql.json(asset)}, ${Buffer.from(result.content)})
        on conflict (owner_key, sha256) do nothing
        returning metadata
      `;
      if (inserted.length) return { asset, previewSource: result.previewSource, created: true };
      const [existing] = await sql<{ metadata: StoredAsset }[]>`select metadata from engine_v3_asset where owner_key = ${ownerKey} and sha256 = ${asset.sha256} limit 1`;
      if (!existing) throw new Error("Stored asset metadata is unavailable");
      return { asset: { ...existing.metadata, ownerId }, previewSource: result.previewSource, created: false };
    },
    async list(ownerId) {
      const ownerKey = await sha256Hex(ownerId);
      const rows = await sql<{ metadata: StoredAsset }[]>`select metadata from engine_v3_asset where owner_key = ${ownerKey} order by created_at desc`;
      return rows.map((row) => ({ ...row.metadata, ownerId }));
    },
    async get(ownerId, sha256) {
      const ownerKey = await sha256Hex(ownerId);
      const [row] = await sql<{ metadata: StoredAsset; content: Uint8Array }[]>`select metadata, content from engine_v3_asset where owner_key = ${ownerKey} and sha256 = ${sha256} limit 1`;
      return row ? { asset: { ...row.metadata, ownerId }, content: new Uint8Array(row.content) } : null;
    },
    async delete(ownerId, sha256) {
      const ownerKey = await sha256Hex(ownerId);
      const rows = await sql`delete from engine_v3_asset where owner_key = ${ownerKey} and sha256 = ${sha256} returning sha256`;
      return rows.length > 0;
    },
  };
}
