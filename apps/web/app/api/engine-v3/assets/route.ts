import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createMemoryAssetStorage, createVercelBlobAssetStorage, type AssetStorage } from "@/lib/engine-v3/asset-storage";
import { isMockDbEnabled } from "@/lib/db/mode";

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
  if (!store.status.available) return NextResponse.json({ error: store.status.reason ?? "Asset storage unavailable", status: store.status }, { status: 503 });
  const sha256 = new URL(request.url).searchParams.get("sha256");
  if (sha256) {
    if (!/^[a-f0-9]{64}$/.test(sha256)) return NextResponse.json({ error: "Invalid asset hash" }, { status: 400 });
    const stored = await store.get(owner, sha256);
    if (!stored) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    return new NextResponse(stored.content.slice().buffer as ArrayBuffer, { headers: { "Content-Type": stored.asset.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  }
  return NextResponse.json({ status: store.status, assets: await store.list(owner) });
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = storage();
  if (!store.status.available) return NextResponse.json({ error: store.status.reason ?? "Asset storage unavailable", status: store.status }, { status: 503 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A file field is required" }, { status: 400 });
  try {
    const result = await store.put({ content: await file.arrayBuffer(), mime: file.type, source: String(form.get("source") ?? file.name), license: String(form.get("license") ?? "") || undefined }, owner);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid asset" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sha256 = new URL(request.url).searchParams.get("sha256") ?? "";
  if (!/^[a-f0-9]{64}$/.test(sha256)) return NextResponse.json({ error: "A valid sha256 query parameter is required" }, { status: 400 });
  const store = storage();
  if (!store.status.available) return NextResponse.json({ error: store.status.reason ?? "Asset storage unavailable", status: store.status }, { status: 503 });
  const deleted = await store.delete(owner, sha256);
  return deleted ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: "Asset not found" }, { status: 404 });
}
