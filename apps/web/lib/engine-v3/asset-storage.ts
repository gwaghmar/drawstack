import type { AssetRef } from "./document.ts";
import { ingestAsset, type AssetIngestionInput } from "./asset-ingestion.ts";
import { del, get, list, put } from "@vercel/blob";
import { sha256Hex } from "./components.ts";

export type StoredAsset = AssetRef & { ownerId: string; byteLength: number; createdAt: string };
export type AssetStorageStatus = { available: boolean; mode: "memory" | "external" | "unavailable"; reason?: string };
export type AssetStorage = {
  status: AssetStorageStatus;
  put(input: AssetIngestionInput, ownerId: string): Promise<{ asset: StoredAsset; previewSource: string; created: boolean }>;
  list(ownerId: string): Promise<StoredAsset[]>;
  get(ownerId: string, sha256: string): Promise<{ asset: StoredAsset; content: Uint8Array } | null>;
  delete(ownerId: string, sha256: string): Promise<boolean>;
};

export type ExternalAssetStore = {
  put(key: string, content: Uint8Array, metadata: StoredAsset): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
};

export function createMemoryAssetStorage(): AssetStorage {
  const records = new Map<string, { asset: StoredAsset; content: Uint8Array }>();
  return {
    status: { available: true, mode: "memory" },
    async put(input, ownerId) {
      const result = await ingestAsset(input);
      const key = ownerId + ":" + result.asset.sha256;
      const existing = records.get(key);
      if (existing) return { asset: existing.asset, previewSource: result.previewSource, created: false };
      const bytes = result.content;
      const asset: StoredAsset = { ...result.asset, ownerId, byteLength: bytes.byteLength, createdAt: new Date().toISOString() };
      records.set(key, { asset, content: bytes });
      return { asset, previewSource: result.previewSource, created: true };
    },
    async list(ownerId) { return [...records.values()].filter((record) => record.asset.ownerId === ownerId).map((record) => record.asset); },
    async get(ownerId, sha256) { const record = records.get(ownerId + ":" + sha256); return record ? { asset: record.asset, content: new Uint8Array(record.content) } : null; },
    async delete(ownerId, sha256) { return records.delete(ownerId + ":" + sha256); },
  };
}

export function createAssetStorage(external?: ExternalAssetStore): AssetStorage {
  if (!external) return {
    status: { available: false, mode: "unavailable", reason: "External asset storage is not configured" },
    async put() { throw new Error("Asset storage unavailable: configure an external object store"); },
    async list() { return []; },
    async get() { return null; },
    async delete() { return false; },
  };
  const metadata = new Map<string, StoredAsset>();
  return {
    status: { available: true, mode: "external" },
    async put(input, ownerId) {
      const result = await ingestAsset(input);
      const key = ownerId + "/" + result.asset.sha256;
      const existing = metadata.get(key);
      if (existing) return { asset: existing, previewSource: result.previewSource, created: false };
      const bytes = result.content;
      const asset: StoredAsset = { ...result.asset, ownerId, byteLength: bytes.byteLength, createdAt: new Date().toISOString() };
      await external.put(key, bytes, asset);
      metadata.set(key, asset);
      return { asset, previewSource: result.previewSource, created: true };
    },
    async list(ownerId) { return [...metadata.values()].filter((asset) => asset.ownerId === ownerId); },
    async get(ownerId, sha256) { const asset = metadata.get(ownerId + "/" + sha256); if (!asset) return null; const content = await external.get(ownerId + "/" + sha256); return content ? { asset, content } : null; },
    async delete(ownerId, sha256) { const key = ownerId + "/" + sha256; if (!metadata.has(key)) return false; await external.delete(key); metadata.delete(key); return true; },
  };
}

export function createVercelBlobAssetStorage(): AssetStorage {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return createAssetStorage();
  return {
    status: { available: true, mode: "external" },
    async put(input, ownerId) {
      const result = await ingestAsset(input);
      const key = "engine-v3/" + await sha256Hex(ownerId) + "/" + result.asset.sha256;
      const existing = (await list({ prefix: key, limit: 1 })).blobs.find((blob) => blob.pathname === key + ".json");
      if (existing) {
        const stored = await get(existing.pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
        if (stored?.statusCode !== 200) throw new Error("Stored asset metadata is unavailable");
        return { asset: JSON.parse(await new Response(stored.stream).text()) as StoredAsset, previewSource: result.previewSource, created: false };
      }
      const bytes = result.content;
      const asset: StoredAsset = { ...result.asset, source: `/api/engine-v3/assets?sha256=${result.asset.sha256}`, ownerId, byteLength: bytes.byteLength, createdAt: new Date().toISOString() };
      await put(key, bytes.buffer as ArrayBuffer, { access: "private", addRandomSuffix: false, contentType: input.mime, token: process.env.BLOB_READ_WRITE_TOKEN });
      await put(key + ".json", JSON.stringify(asset), { access: "private", addRandomSuffix: false, contentType: "application/json", token: process.env.BLOB_READ_WRITE_TOKEN });
      return { asset, previewSource: result.previewSource, created: true };
    },
    async list(ownerId) {
      const entries = (await list({ prefix: "engine-v3/" + await sha256Hex(ownerId) + "/", token: process.env.BLOB_READ_WRITE_TOKEN })).blobs.filter((blob) => blob.pathname.endsWith(".json"));
      return Promise.all(entries.map(async (blob) => {
        const stored = await get(blob.pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
        if (stored?.statusCode !== 200) throw new Error("Stored asset metadata is unavailable");
        return JSON.parse(await new Response(stored.stream).text()) as StoredAsset;
      }));
    },
    async get(ownerId, sha256) {
      const key = "engine-v3/" + await sha256Hex(ownerId) + "/" + sha256;
      const entries = (await list({ prefix: key, limit: 2, token: process.env.BLOB_READ_WRITE_TOKEN })).blobs;
      const metadata = entries.find((blob) => blob.pathname === key + ".json");
      const content = entries.find((blob) => blob.pathname === key);
      if (!metadata || !content) return null;
      const [metadataResult, contentResult] = await Promise.all([
        get(metadata.pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN }),
        get(content.pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN }),
      ]);
      if (metadataResult?.statusCode !== 200 || contentResult?.statusCode !== 200) return null;
      return { asset: JSON.parse(await new Response(metadataResult.stream).text()) as StoredAsset, content: new Uint8Array(await new Response(contentResult.stream).arrayBuffer()) };
    },
    async delete(ownerId, sha256) {
      const key = "engine-v3/" + await sha256Hex(ownerId) + "/" + sha256;
      const entries = (await list({ prefix: key, limit: 2, token: process.env.BLOB_READ_WRITE_TOKEN })).blobs;
      if (!entries.length) return false;
      await del(entries.map((entry) => entry.url), { token: process.env.BLOB_READ_WRITE_TOKEN });
      return true;
    },
  };
}
