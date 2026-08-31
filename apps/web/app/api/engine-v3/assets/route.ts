import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteAsset, getAsset, listAssets, uploadAsset } from "@/lib/engine-v3/asset-api";
import { runtimeAssetStorage } from "@/lib/engine-v3/runtime-asset-storage";
async function ownerId() { return (await auth())?.user?.email ?? null; }

export async function GET(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = runtimeAssetStorage();
  const sha256 = new URL(request.url).searchParams.get("sha256");
  return sha256 ? getAsset(store, owner, sha256) : listAssets(store, owner);
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return uploadAsset(runtimeAssetStorage(), owner, request);
}

export async function DELETE(request: Request) {
  const owner = await ownerId();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sha256 = new URL(request.url).searchParams.get("sha256") ?? "";
  return deleteAsset(runtimeAssetStorage(), owner, sha256);
}
