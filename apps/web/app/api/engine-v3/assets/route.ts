import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createMemoryAssetStorage, createVercelBlobAssetStorage, type AssetStorage } from "@/lib/engine-v3/asset-storage";
import { isMockDbEnabled } from "@/lib/db/mode";
import { deleteAsset, getAsset, listAssets, uploadAsset } from "@/lib/engine-v3/asset-api";

const globalStore = globalThis as typeof globalThis & { __engineV3AssetStore?: AssetStorage };
function storage(): AssetStorage {
  if (isMockDbEnabled() && !process.env.BLOB_READ_WRITE_TOKEN) return globalStore.__engineV3AssetStore ??= createMemoryAssetStorage();
  return createVercelBlobAssetStorage();
}
async function ownerId() { return (await auth())?.user?.email ?? null; }

export async function GET(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = storage();
  const sha256 = new URL(request.url).searchParams.get("sha256");
  return sha256 ? getAsset(store, owner, sha256) : listAssets(store, owner);
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return uploadAsset(storage(), owner, request);
}

export async function DELETE(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sha256 = new URL(request.url).searchParams.get("sha256") ?? "";
  return deleteAsset(storage(), owner, sha256);
}
