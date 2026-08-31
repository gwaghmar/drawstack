import { isMockDbEnabled } from "@/lib/db/mode";
import { createMemoryAssetStorage, createVercelBlobAssetStorage, type AssetStorage } from "./asset-storage.ts";
import { createPostgresAssetStorage } from "./postgres-asset-storage.ts";

const globalStore = globalThis as typeof globalThis & { __engineV3AssetStore?: AssetStorage };

export function runtimeAssetStorage(): AssetStorage {
  if (isMockDbEnabled() && !process.env.BLOB_READ_WRITE_TOKEN) return globalStore.__engineV3AssetStore ??= createMemoryAssetStorage();
  if (process.env.BLOB_READ_WRITE_TOKEN) return createVercelBlobAssetStorage();
  return createPostgresAssetStorage();
}
